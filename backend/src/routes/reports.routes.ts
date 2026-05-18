import { Router, Request, Response, NextFunction } from 'express';
import { ReportBodySchema, ResolveReportBodySchema } from '../types/index.js';
import * as dbService from '../services/db.service.js';
import { ConflictError, NotFoundError } from '../services/db.service.js';
import { logger } from '../utils/logger.js';
import { deviceIdMiddleware } from '../middleware/device-id.middleware.js';
import { reportRateLimiter } from '../middleware/rate-limiter.middleware.js';

const router = Router();

router.use(deviceIdMiddleware);

// POST /reports — anyone with a registered device can submit. Idempotent on
// (reporter, target_kind, target_id) tuple while a prior report on the same
// target is still open. See #14a for the App Review §1.2 context.
//
// Rate-limited (20/hr/device) — idempotency only dedupes exact tuples, so
// without a limiter a malicious user could flood the moderation queue with
// reports against fabricated target_ids and degrade the very signal §1.2
// compliance depends on.
router.post('/reports', reportRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ReportBodySchema.parse(req.body);
    await dbService.createReport(
      req.deviceId!,
      body.target_kind,
      body.target_id,
      body.category,
      body.free_text,
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /reports?status=open — admin-only. Operator pulls the pending
// moderation queue via curl using their own ADMIN_DEVICE_IDS-allowlisted
// device id (set on Cloud Run, persists across deploys since #28).
router.get('/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!dbService.isAdminDevice(req.deviceId!)) {
      res.status(403).json({ error: 'forbidden', message: 'Admin only' });
      return;
    }
    // status filter is fixed to 'open' for v1 — moderation queue only. If we
    // ever want resolved-history reads, add a status param + validate.
    const reports = await dbService.listOpenReports();
    res.json(reports);
  } catch (error) {
    next(error);
  }
});

// POST /reports/:id/resolve — admin-only. Body { action: 'dismissed' |
// 'content_removed' | 'user_banned' }. content_removed hides the target
// session memory; user_banned hides every session the target user owns.
// Neither inserts a block row — block table stays user-initiated.
router.post('/reports/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!dbService.isAdminDevice(req.deviceId!)) {
      res.status(403).json({ error: 'forbidden', message: 'Admin only' });
      return;
    }
    const id = req.params.id as string;
    const body = ResolveReportBodySchema.parse(req.body);
    const resolved = await dbService.resolveReport(id, body.action, req.deviceId!);
    logger.info(
      { reportId: id, action: body.action, adminDeviceId: req.deviceId },
      'Report resolved by admin',
    );
    res.json(resolved);
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: 'not_found', message: error.message });
      return;
    }
    if (error instanceof ConflictError) {
      res.status(409).json({ error: 'conflict', message: error.message });
      return;
    }
    next(error);
  }
});

export default router;
