import { Router, Request, Response, NextFunction } from 'express';
import { deviceIdMiddleware } from '../middleware/device-id.middleware.js';
import * as dbService from '../services/db.service.js';

const router = Router();

router.use(deviceIdMiddleware);

// GET /feed — recent sessions from people I follow, newest first.
router.get('/feed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await dbService.getFollowedSessionFeed(req.deviceId!);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// GET /feed/sessions/:sessionId — full detail for a single followed session.
// Authorization: requester must have an accepted follow of the session's owner.
router.get('/feed/sessions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.sessionId as string;

    const found = await dbService.findSessionMemoryWithOwner(sessionId);
    if (!found) {
      res.status(404).json({ error: 'not_found', message: 'Session not found' });
      return;
    }
    const { memory, ownerDeviceId } = found;

    // Owner is always allowed to read their own session; otherwise require an
    // accepted follow. Returning 404 (rather than 403) for non-followers keeps
    // session existence out of the response.
    if (ownerDeviceId !== req.deviceId) {
      const ok = await dbService.isAcceptedFollower(req.deviceId!, ownerDeviceId);
      if (!ok) {
        res.status(404).json({ error: 'not_found', message: 'Session not visible' });
        return;
      }
    }

    // Look up the follower's alias for the owner (if any) — only meaningful
    // when the requester isn't the owner themselves.
    let followerAlias: string | null = null;
    let ownerName: string | undefined;
    if (ownerDeviceId !== req.deviceId) {
      const following = await dbService.listFollowing(req.deviceId!);
      const match = following.find((f) => f.followee_device_id === ownerDeviceId);
      if (match) {
        followerAlias = match.follower_alias ?? null;
        ownerName = match.followee_name;
      }
    }

    const images = await dbService.getSessionImages(sessionId);

    res.json({
      session_id: memory.session_id,
      followee_device_id: ownerDeviceId,
      followee_name: ownerName,
      follower_alias: followerAlias,
      summary: memory.summary,
      tips: memory.tips ?? [],
      products: memory.products ?? [],
      duration_seconds: memory.duration_seconds,
      occasion: memory.occasion,
      created_at: memory.created_at,
      images: images.map((i) => ({
        url: i.storage_url,
        mime_type: i.mime_type,
        prompt: i.prompt,
        description: i.description ?? null,
        expires_at: i.expires_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
