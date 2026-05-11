import { Router, Request, Response, NextFunction } from 'express';
import { getEnv } from '../config/env.js';
import * as dbService from '../services/db.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /internal/purge-images — invoked on a schedule (Cloud Scheduler, GH
// Actions cron, etc.) to delete session_images rows whose expires_at has
// passed. Protected by a shared secret in the X-Internal-Secret header so
// it can't be hit from the public internet.
router.post('/internal/purge-images', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const env = getEnv();
    if (!env.PURGE_SECRET) {
      res.status(503).json({ error: 'disabled', message: 'PURGE_SECRET not configured' });
      return;
    }
    const provided = req.header('x-internal-secret');
    if (provided !== env.PURGE_SECRET) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const purged = await dbService.purgeExpiredSessionImages();
    logger.info({ purged }, 'Expired session images purged');
    res.json({ purged });
  } catch (error) {
    next(error);
  }
});

export default router;
