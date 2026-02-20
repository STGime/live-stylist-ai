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
    const user = await firebaseService.createUser(req.deviceId!, body.name, body.favorite_color);
    res.status(201).json({
      device_id: req.deviceId,
      name: user.name,
      favorite_color: user.favorite_color,
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
    });
  } catch (error) {
    next(error);
  }
});

export default router;
