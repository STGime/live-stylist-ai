import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { deviceIdMiddleware } from '../middleware/device-id.middleware.js';
import { followRequestRateLimiter } from '../middleware/rate-limiter.middleware.js';
import * as dbService from '../services/db.service.js';
import { isValidMagicId, normalizeMagicId } from '../services/magic-id.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(deviceIdMiddleware);

// Block by magic_id keeps the input surface identical to follow requests —
// the user never has to know the target's device_id. We also accept
// follow_id so the app can offer a one-tap "Block" action straight from a
// follower row, which is the most common case.
const CreateBlockBody = z
  .object({
    magic_id: z.string().min(1).max(40).optional(),
    follow_id: z.string().uuid().optional(),
  })
  .refine((b) => !!b.magic_id || !!b.follow_id, {
    message: 'Provide either magic_id or follow_id',
  });

// GET /blocks — list users I've blocked.
router.get('/blocks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await dbService.listBlocks(req.deviceId!);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// POST /blocks — body { magic_id } OR { follow_id }. Idempotent.
// Reuses followRequestRateLimiter because both paths go through the same
// "act on another user keyed by magic_id" surface area.
router.post('/blocks', followRequestRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateBlockBody.parse(req.body);

    let targetDeviceId: string | null = null;
    let targetName: string | undefined;
    let targetMagicId: string | undefined;

    if (body.magic_id) {
      const normalized = normalizeMagicId(body.magic_id);
      if (!isValidMagicId(normalized)) {
        res.status(400).json({ error: 'invalid_magic_id', message: 'Magic ID format is invalid' });
        return;
      }
      const target = await dbService.getUserByMagicId(normalized);
      if (!target) {
        res.status(404).json({ error: 'not_found', message: 'No user with that magic ID' });
        return;
      }
      targetDeviceId = target.deviceId;
      targetName = target.profile.name;
      targetMagicId = target.profile.magic_id;
    } else if (body.follow_id) {
      const follow = await dbService.getFollowById(body.follow_id);
      if (!follow) {
        res.status(404).json({ error: 'not_found', message: 'Follow not found' });
        return;
      }
      // Pick the "other side" of the follow row relative to the requester.
      if (follow.follower_device_id === req.deviceId) {
        targetDeviceId = follow.followee_device_id;
      } else if (follow.followee_device_id === req.deviceId) {
        targetDeviceId = follow.follower_device_id;
      } else {
        res.status(404).json({ error: 'not_found', message: 'Follow not found' });
        return;
      }
    }

    if (!targetDeviceId) {
      // Unreachable thanks to the zod refine above, but keeps the type checker happy.
      res.status(400).json({ error: 'bad_request' });
      return;
    }

    if (targetDeviceId === req.deviceId) {
      res.status(400).json({ error: 'self_block', message: 'You cannot block yourself' });
      return;
    }

    const { row, created } = await dbService.createBlock(req.deviceId!, targetDeviceId);

    // No push is sent in either direction — silent block by design.
    logger.info(
      { blocker: req.deviceId, target: targetDeviceId, blockId: row.id, created },
      'Block applied',
    );

    res.status(created ? 201 : 200).json({
      id: row.id,
      blocked_device_id: row.blocked_device_id,
      blocked_name: targetName,
      blocked_magic_id: targetMagicId,
      created_at: row.created_at,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /blocks/:id — unblock.
router.delete('/blocks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await dbService.deleteBlock(req.params.id as string, req.deviceId!);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
