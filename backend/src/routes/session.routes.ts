import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { deviceIdMiddleware } from '../middleware/device-id.middleware.js';
import { sessionStartRateLimiter } from '../middleware/rate-limiter.middleware.js';
import * as dbService from '../services/db.service.js';
import * as revenuecatService from '../services/revenuecat.service.js';
import * as sessionManager from '../services/session-manager.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(deviceIdMiddleware);

const StartSessionBodySchema = z.object({
  occasion: z.enum(['casual', 'work', 'date_night', 'event', 'going_out', 'selfcare']).optional(),
  region: z.enum(['eu', 'us']).optional(),
}).optional();

const EndSessionBodySchema = z.object({
  session_id: z.string().uuid(),
});

// POST /start-session
router.post('/start-session', sessionStartRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const deviceId = req.deviceId!;
  const body = StartSessionBodySchema?.parse(req.body);
  const occasion = body?.occasion;
  const region = body?.region;

  try {
    // 1. Check for existing active session — end it and start fresh
    const existingSession = sessionManager.getSessionByDevice(deviceId);
    if (existingSession) {
      logger.info({ deviceId, sessionId: existingSession.session_id }, 'Ending existing session before starting new one');
      await sessionManager.endSession(existingSession.session_id, 'replaced');
    }

    // 2. Check subscription tier — tester check first; falls back to
    //    RevenueCat entitlement lookup. Tester bypasses the lifetime
    //    trial gate and gets a separate (much higher) monthly cap.
    const testerSecret = req.get('x-tester-secret') ?? undefined;
    const tier = dbService.isTesterDevice(deviceId, testerSecret)
      ? 'tester' as const
      : await revenuecatService.checkEntitlement(deviceId);

    // 3. Load user profile
    const user = await dbService.getUser(deviceId);
    if (!user) {
      res.status(404).json({ error: 'not_found', message: 'User not registered. Call POST /register first.' });
      return;
    }

    // 4. Tier gate (lifetime trial for free; monthly cap for tester/premium).
    const sessionCheck = await dbService.incrementSessionCount(deviceId, tier);
    if (!sessionCheck.allowed) {
      const message =
        sessionCheck.reason === 'trial_used'
          ? 'Your free session is used up. Subscribe to continue.'
          : 'You have reached your monthly session limit.';
      res.status(402).json({
        error: sessionCheck.reason ?? 'tier_limit',
        message,
      });
      return;
    }

    // 5. Create in-memory session with timers
    const session = sessionManager.startSession(deviceId, tier, occasion, region);

    // 6. Persist session record to Eurobase
    await dbService.createSessionRecord(session.session_id, deviceId, tier);

    // 7. Build backend WebSocket URL for ADK session
    const protocol = req.protocol === 'https' ? 'wss' : 'ws';
    const host = req.get('host') || 'localhost:8080';
    const wsUrl = `${protocol}://${host}/ws/adk?session_id=${session.session_id}&device_id=${deviceId}`;

    logger.info({ deviceId, sessionId: session.session_id, tier }, 'Session started successfully');

    res.status(201).json({
      session_id: session.session_id,
      session_expiry_time: session.expires_at,
      remaining_sessions_this_month: sessionCheck.remaining ?? null,
      ws_url: wsUrl,
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
