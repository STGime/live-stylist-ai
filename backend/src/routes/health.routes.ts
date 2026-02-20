import { Router, Request, Response } from 'express';
import { getDb } from '../config/firebase';
import { getActiveSessionCount } from '../services/session-manager.service';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    active_sessions: getActiveSessionCount(),
  });
});

router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    // Simple connectivity check - list collections (lightweight)
    await db.listCollections();
    res.json({ status: 'ready', firestore: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', firestore: 'disconnected' });
  }
});

export default router;
