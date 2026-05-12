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

    // Walk follows: find an accepted edge whose followee owns this session_id.
    const following = await dbService.listFollowing(req.deviceId!);
    let memory: Awaited<ReturnType<typeof dbService.getSessionMemory>> | null = null;
    let ownerDeviceId: string | null = null;
    let ownerName: string | undefined;
    let followerAlias: string | null = null;
    for (const f of following) {
      const candidate = await dbService.getSessionMemory(f.followee_device_id, sessionId);
      if (candidate) {
        memory = candidate;
        ownerDeviceId = f.followee_device_id;
        ownerName = f.followee_name;
        followerAlias = f.follower_alias ?? null;
        break;
      }
    }

    if (!memory || !ownerDeviceId) {
      res.status(404).json({ error: 'not_found', message: 'Session not visible' });
      return;
    }

    const images = await dbService.getSessionImages(sessionId);

    const ownerId: string = ownerDeviceId;
    res.json({
      session_id: memory.session_id,
      followee_device_id: ownerId,
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
