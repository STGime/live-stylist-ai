import { Router, Request, Response, NextFunction } from 'express';
import { RegisterBodySchema, UpdateProfileBodySchema } from '../types';
import * as firebaseService from '../services/firebase.service';
import { deviceIdMiddleware } from '../middleware/device-id.middleware';

const router = Router();

router.use(deviceIdMiddleware);

// POST /register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RegisterBodySchema.parse(req.body);
    const user = await firebaseService.createUser(req.deviceId!, body.name, body.favorite_color, body.stylist_name, body.language);
    res.status(201).json({
      device_id: req.deviceId,
      name: user.name,
      favorite_color: user.favorite_color,
      stylist_name: user.stylist_name,
      language: user.language,
      created_at: user.created_at.toDate().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /profile
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await firebaseService.getUser(req.deviceId!);
    if (!user) {
      res.status(404).json({ error: 'not_found', message: 'User not registered' });
      return;
    }
    res.json({
      device_id: req.deviceId,
      name: user.name,
      favorite_color: user.favorite_color,
      stylist_name: user.stylist_name,
      language: user.language,
      sessions_used_today: user.sessions_used_today,
      last_session_date: user.last_session_date,
      created_at: user.created_at.toDate().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// PUT /profile
router.put('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = UpdateProfileBodySchema.parse(req.body);
    const user = await firebaseService.updateUser(req.deviceId!, body);
    res.json({
      device_id: req.deviceId,
      name: user.name,
      favorite_color: user.favorite_color,
      stylist_name: user.stylist_name,
      language: user.language,
    });
  } catch (error) {
    next(error);
  }
});

// GET /session-history
router.get('/session-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memories = await firebaseService.getSessionHistory(req.deviceId!);
    const items = memories.map(m => ({
      session_id: m.session_id,
      summary: m.summary,
      tips: m.tips || [],
      duration_seconds: m.duration_seconds,
      occasion: m.occasion,
      created_at: m.created_at.toDate().toISOString(),
    }));
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// GET /session-summary/:sessionId
router.get('/session-summary/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.sessionId as string;
    const memory = await firebaseService.getSessionMemory(req.deviceId!, sessionId);
    if (!memory) {
      res.status(404).json({ error: 'not_found', message: 'Session summary not found' });
      return;
    }
    res.json({
      session_id: memory.session_id,
      summary: memory.summary,
      tips: memory.tips || [],
      duration_seconds: memory.duration_seconds,
      occasion: memory.occasion,
      created_at: memory.created_at.toDate().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
