import { Router, Request, Response } from 'express';
import { getEurobase } from '../config/eurobase.js';
import { getActiveSessionCount } from '../services/session-manager.service.js';

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
    const eb = getEurobase();
    const { ok, latency_ms } = await eb.status();
    if (!ok) {
      res.status(503).json({ status: 'not_ready', eurobase: 'disconnected' });
      return;
    }
    res.json({ status: 'ready', eurobase: 'connected', latency_ms });
  } catch (_error) {
    res.status(503).json({ status: 'not_ready', eurobase: 'disconnected' });
  }
});

export default router;
