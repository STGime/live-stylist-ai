import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { deviceIdMiddleware } from '../middleware/device-id.middleware';
import { sessionStartRateLimiter } from '../middleware/rate-limiter.middleware';
import * as firebaseService from '../services/firebase.service';
import * as revenuecatService from '../services/revenuecat.service';
import * as geminiService from '../services/gemini.service';
import * as sessionManager from '../services/session-manager.service';
import { logger } from '../utils/logger';

const router = Router();

router.use(deviceIdMiddleware);

const EndSessionBodySchema = z.object({
  session_id: z.string().uuid(),
});

// POST /start-session
router.post('/start-session', sessionStartRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const deviceId = req.deviceId!;

  try {
    // 1. Check for existing active session — end it and start fresh
    const existingSession = sessionManager.getSessionByDevice(deviceId);
    if (existingSession) {
      logger.info({ deviceId, sessionId: existingSession.session_id }, 'Ending existing session before starting new one');
      await sessionManager.endSession(existingSession.session_id, 'replaced');
    }

    // 2. Check subscription tier
    const tier = await revenuecatService.checkEntitlement(deviceId);

    // 3. Load user profile
    const user = await firebaseService.getUser(deviceId);
    if (!user) {
      res.status(404).json({ error: 'not_found', message: 'User not registered. Call POST /register first.' });
      return;
    }

    // 4. Check/increment daily session count
    const sessionCheck = await firebaseService.incrementSessionCount(deviceId, tier);
    if (!sessionCheck.allowed) {
      res.status(429).json({
        error: 'session_limit_exceeded',
        message: `Daily session limit reached for ${tier} tier`,
        sessions_used_today: sessionCheck.sessionsUsedToday,
        remaining_sessions_today: 0,
      });
      return;
    }

    // 5. Generate Gemini ephemeral token
    const { token, wsUrl } = await geminiService.generateEphemeralToken();

    // 6. Build personalized system prompt
    const systemPrompt = geminiService.buildSystemPrompt(user);

    // 7. Create in-memory session with timers
    const session = sessionManager.startSession(deviceId, tier);

    // 8. Persist session record to Firestore
    await firebaseService.createSessionRecord(session.session_id, deviceId, tier);

    logger.info({ deviceId, sessionId: session.session_id, tier }, 'Session started successfully');

    res.status(201).json({
      session_id: session.session_id,
      ephemeral_token: token,
      system_prompt: systemPrompt,
      session_expiry_time: session.expires_at,
      remaining_sessions_today: sessionCheck.remaining,
      gemini_model: geminiService.getGeminiModel(),
      gemini_ws_url: wsUrl,
    });
  } catch (error) {
    next(error);
  }
});

// POST /end-session
router.post('/end-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { session_id } = EndSessionBodySchema.parse(req.body);

    const session = sessionManager.getActiveSession(session_id);
    if (!session) {
      res.status(404).json({ error: 'not_found', message: 'Session not found or already ended' });
      return;
    }

    // Verify device ownership
    if (session.device_id !== req.deviceId) {
      res.status(403).json({ error: 'forbidden', message: 'Session does not belong to this device' });
      return;
    }

    const result = await sessionManager.endSession(session_id, 'manual');
    if (!result) {
      res.status(404).json({ error: 'not_found', message: 'Session not found or already ended' });
      return;
    }

    res.json({
      session_id,
      duration_seconds: result.duration_seconds,
      reason: 'manual',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
