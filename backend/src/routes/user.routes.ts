import { Router, Request, Response, NextFunction } from 'express';
import { RegisterBodySchema, UpdateProfileBodySchema, LinkStableIdBodySchema } from '../types/index.js';
import * as dbService from '../services/db.service.js';
import * as revenuecatService from '../services/revenuecat.service.js';
import { ConflictError } from '../services/db.service.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { deviceIdMiddleware } from '../middleware/device-id.middleware.js';

const router = Router();

router.use(deviceIdMiddleware);

// POST /register
//
// If the body carries a `stable_device_id` that already exists on a user
// row, we treat this as a recovery (post-reinstall): return the original
// user with its original `device_id`, so the client can swap its
// provisional uuid for the canonical one and pick up where the old
// install left off. Status 200 vs the usual 201 signals "existing user".
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RegisterBodySchema.parse(req.body);

    if (body.stable_device_id) {
      const existing = await dbService.getUserByStableDeviceId(body.stable_device_id);
      if (existing) {
        // Recovery path: the user typed a fresh name/color in Onboarding
        // (AsyncStorage was wiped on reinstall, so the app had no way to
        // know we'd seen them before), but the *persisted* profile wins.
        // We don't merge in the request body — "welcome back, original
        // name" is the contract. The client surfaces this via the
        // `recovered: true` flag.
        res.status(200).json({
          device_id: existing.deviceId,
          name: existing.profile.name,
          favorite_color: existing.profile.favorite_color,
          stylist_name: existing.profile.stylist_name,
          language: existing.profile.language,
          created_at: existing.profile.created_at,
          recovered: true,
        });
        return;
      }
    }

    const user = await dbService.createUser(
      req.deviceId!,
      body.name,
      body.favorite_color,
      body.stylist_name,
      body.language,
      body.stable_device_id,
    );
    res.status(201).json({
      device_id: req.deviceId,
      name: user.name,
      favorite_color: user.favorite_color,
      stylist_name: user.stylist_name,
      language: user.language,
      created_at: user.created_at,
    });
  } catch (error) {
    next(error);
  }
});

// POST /me/link-stable-id — retrofit a stable id onto the existing user.
// Used by pre-existing clients on their first launch with the upgraded
// app: they have a device_id already, just no stable_device_id yet, so
// without this their *next* reinstall would still mint a new user.
router.post('/me/link-stable-id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = LinkStableIdBodySchema.parse(req.body);
    await dbService.linkStableDeviceId(req.deviceId!, body.stable_device_id);
    res.status(204).send();
  } catch (error) {
    // Log conflicts loudly: the client will keep retrying this every
    // launch until /profile shows has_stable_device_id: true, so a
    // stuck row produces N daily attempts per affected user. Surfacing
    // it in logs lets us catch the pattern in prod.
    if (error instanceof ConflictError) {
      logger.warn(
        { deviceId: req.deviceId, msg: error.message },
        'link-stable-id conflict — row already has a different stable_device_id',
      );
    }
    next(error);
  }
});

// GET /profile
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await dbService.getUser(req.deviceId!);
    if (!user) {
      res.status(404).json({ error: 'not_found', message: 'User not registered' });
      return;
    }
    // Resolve effective tier. Tester check is local (no RC round-trip).
    // For non-testers we use tryCheckEntitlement (returns null on RC
    // errors) rather than checkEntitlement (collapses errors to 'free').
    // If RC is unreachable we OMIT the three tier fields — the app then
    // falls back to its on-device RC SDK signal, which is more reliable
    // than the server faking 'free' during an RC outage and downgrading
    // a paying user's pill to "1 of 1, upgrade".
    const testerSecret = req.get('x-tester-secret') ?? undefined;
    let tier: 'free' | 'premium' | 'tester' | null;
    if (dbService.isTesterDevice(req.deviceId!, testerSecret)) {
      tier = 'tester';
    } else {
      tier = await revenuecatService.tryCheckEntitlement(req.deviceId!);
    }

    const baseResponse = {
      device_id: req.deviceId,
      name: user.name,
      favorite_color: user.favorite_color,
      stylist_name: user.stylist_name,
      language: user.language,
      trial_used: user.trial_used,
      created_at: user.created_at,
      magic_id: user.magic_id,
      // Boolean shape rather than leaking the raw Expo token to the client —
      // the app only needs "is push currently on for this device?".
      notifications_enabled: !!user.expo_push_token,
      // Tells pre-existing clients whether to fire the link-stable-id retrofit
      // on this launch. Once true, the next reinstall recovers them via
      // POST /register; until then, a reinstall still mints a new user row.
      has_stable_device_id: !!user.stable_device_id,
    };

    if (tier === null) {
      // RC unreachable. Omit tier-aware fields so the client falls back
      // to its legacy guess (which uses the on-device RC SDK truth).
      res.json(baseResponse);
      return;
    }

    const env = getEnv();
    const monthlySessionCap =
      tier === 'tester'
        ? env.TESTER_MONTHLY_SESSION_CAP
        : tier === 'premium'
          ? env.MONTHLY_PREMIUM_SESSION_CAP
          : 1; // free = 1 lifetime trial; expose as a 1-cap for symmetry
    // For free tier, the "month" concept doesn't apply — show 1/1 until
    // trial_used flips, then 0/1. For premium/tester, count real
    // sessions this calendar month.
    const sessionsUsedThisMonth =
      tier === 'free'
        ? (user.trial_used ? 1 : 0)
        : await dbService.getSessionsUsedThisMonth(req.deviceId!);

    res.json({
      ...baseResponse,
      tier,
      monthly_session_cap: monthlySessionCap,
      sessions_used_this_month: sessionsUsedThisMonth,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /profile
router.put('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = UpdateProfileBodySchema.parse(req.body);
    const user = await dbService.updateUser(req.deviceId!, body);
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

// DELETE /account — Apple-required: hard-deletes profile + all sessions + memories.
router.delete('/account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await dbService.deleteUserAndAllData(req.deviceId!);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /session-history
//
// Returns the caller's own session memories newest-first, each enriched
// with `image_urls` — up to the 24h-TTL captured previews. The thumbnail
// strip on SessionHistoryScreen renders these inline, matching the
// follower-feed card layout so the owner sees the same image-rich
// summary of their own sessions instead of a text-only card.
router.get('/session-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memories = await dbService.getSessionHistory(req.deviceId!);
    // Parallel image fetch per session — same pattern as
    // getFollowedSessionFeed avoids n+1 sequential round-trips. Image
    // failures are non-fatal (card just renders without the strip), but
    // log them so a systemic Eurobase / schema issue doesn't go quiet.
    const imagesBySession = new Map<string, string[]>();
    await Promise.all(
      memories.map(async (m) => {
        const imgs = await dbService.getSessionImages(m.session_id).catch((err) => {
          logger.warn(
            { sessionId: m.session_id, err: err instanceof Error ? err.message : err },
            '/session-history: image fetch failed',
          );
          return [];
        });
        imagesBySession.set(m.session_id, imgs.map((i) => i.storage_url));
      }),
    );
    const items = memories.map(m => ({
      session_id: m.session_id,
      summary: m.summary,
      tips: m.tips || [],
      duration_seconds: m.duration_seconds,
      occasion: m.occasion,
      created_at: m.created_at,
      image_urls: imagesBySession.get(m.session_id) ?? [],
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
    const memory = await dbService.getSessionMemory(req.deviceId!, sessionId);
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
      created_at: memory.created_at,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
