import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { deviceIdMiddleware } from '../middleware/device-id.middleware.js';
import * as dbService from '../services/db.service.js';
import { isValidMagicId, normalizeMagicId } from '../services/magic-id.service.js';
import * as push from '../services/push.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(deviceIdMiddleware);

const FollowRequestBody = z.object({
  magic_id: z.string().min(1).max(40),
  alias: z.string().max(60).optional().nullable(),
});

const RespondBody = z.object({
  action: z.enum(['accept', 'deny']),
});

const PushTokenBody = z.object({
  token: z.string().min(1).max(200),
});

const AliasBody = z.object({
  alias: z.string().max(60).nullable(),
});

// GET /me/magic-id — current user's shareable ID.
router.get('/me/magic-id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await dbService.getUser(req.deviceId!);
    if (!user) {
      res.status(404).json({ error: 'not_found', message: 'User not registered' });
      return;
    }
    if (!user.magic_id) {
      res.status(500).json({ error: 'no_magic_id', message: 'Magic ID not assigned' });
      return;
    }
    res.json({ magic_id: user.magic_id });
  } catch (error) {
    next(error);
  }
});

// POST /me/push-token — register or update this device's Expo push token.
router.post('/me/push-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = PushTokenBody.parse(req.body);
    await dbService.setExpoPushToken(req.deviceId!, body.token);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// DELETE /me/push-token — clear when user revokes notification permission.
router.delete('/me/push-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await dbService.setExpoPushToken(req.deviceId!, null);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /follows/request — body { magic_id }. Sends a follow request to the
// owner of that magic_id. Idempotent: re-requesting a pending or denied row
// re-opens it; 409 if already accepted.
router.post('/follows/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = FollowRequestBody.parse(req.body);
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

    if (target.deviceId === req.deviceId) {
      res.status(400).json({ error: 'self_follow', message: 'You cannot follow yourself' });
      return;
    }

    const { row } = await dbService.createFollowRequest(req.deviceId!, target.deviceId, body.alias ?? null);
    const me = await dbService.getUser(req.deviceId!);

    push.sendPush(
      target.deviceId,
      'follow_request',
      'New follow request',
      `${me?.name ?? 'Someone'} wants to follow your sessions`,
      { follow_id: row.id },
    ).catch((err) => logger.warn({ err }, 'follow request push failed'));

    res.status(201).json({
      id: row.id,
      status: row.status,
      followee: {
        name: target.profile.name,
        magic_id: target.profile.magic_id,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /follows/:id/respond — accept or deny a pending follow request.
router.post('/follows/:id/respond', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const body = RespondBody.parse(req.body);
    const updated = await dbService.respondToFollow(id, req.deviceId!, body.action);

    if (body.action === 'accept') {
      const me = await dbService.getUser(req.deviceId!);
      push.sendPush(
        updated.follower_device_id,
        'follow_accepted',
        'Follow accepted',
        `${me?.name ?? 'Someone'} accepted your follow request`,
        { follow_id: updated.id },
      ).catch((err) => logger.warn({ err }, 'follow accept push failed'));
    }

    res.json({ id: updated.id, status: updated.status });
  } catch (error) {
    next(error);
  }
});

// PATCH /follows/:id/alias — follower renames the user they're following.
// Pass { alias: null } to clear it (falls back to the followee's profile name
// in the UI).
router.patch('/follows/:id/alias', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const body = AliasBody.parse(req.body);
    const updated = await dbService.updateFollowerAlias(id, req.deviceId!, body.alias);
    res.json({ id: updated.id, follower_alias: updated.follower_alias ?? null });
  } catch (error) {
    next(error);
  }
});

// DELETE /follows/:id — either side severs the relationship.
router.delete('/follows/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await dbService.deleteFollow(req.params.id as string, req.deviceId!);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /follows/pending — incoming requests awaiting my decision.
router.get('/follows/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await dbService.listPendingFollowsForFollowee(req.deviceId!);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /follows/following — accepted follows I created.
router.get('/follows/following', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await dbService.listFollowing(req.deviceId!);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /follows/followers — accepted follows where I'm the target.
router.get('/follows/followers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await dbService.listFollowers(req.deviceId!);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

export default router;
