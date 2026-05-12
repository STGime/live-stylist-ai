import { getEurobase } from '../config/eurobase.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { generateMagicId } from './magic-id.service.js';
import type {
  UserProfile,
  SessionRecord,
  SessionMemory,
  SubscriptionTier,
  FollowRow,
  FollowStatus,
  SessionImageRow,
} from '../types/index.js';

// 'users' is reserved by the Eurobase platform auth users table, so device-keyed
// profile data lives in 'app_users'.
const USERS_TABLE = 'app_users';
const SESSIONS_TABLE = 'sessions';
const MEMORIES_TABLE = 'session_memories';
const FOLLOWS_TABLE = 'follows';
const SESSION_IMAGES_TABLE = 'session_images';

const IMAGE_TTL_HOURS = 24;

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

interface UserRow extends UserProfile {
  id: string;
  device_id: string;
}

interface SessionRow extends SessionRecord {
  id: string;
}

interface MemoryRow extends SessionMemory {
  id: string;
  device_id: string;
}

function stripRow<T extends { id?: string; device_id?: string }>(row: T): Omit<T, 'id' | 'device_id'> {
  const { id: _id, device_id: _did, ...rest } = row;
  return rest;
}

// --- Users ---

export async function createUser(
  deviceId: string,
  name: string,
  favoriteColor: string,
  stylistName?: string,
  language?: string,
): Promise<UserProfile> {
  const eb = getEurobase();

  const existing = await eb.db.from<UserRow>(USERS_TABLE).select('id').eq('device_id', deviceId).single();
  if (existing.data) {
    throw new ConflictError('User already registered');
  }

  // Pick a magic_id, retrying ONLY on its unique-index violation. Any other
  // unique constraint (e.g. device_id) means a caller-side race or a genuine
  // duplicate; retrying would hide that.
  const MAGIC_ID_CONSTRAINT = 'app_users_magic_id_uniq';
  let inserted: UserRow | null = null;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const magicId = generateMagicId();
    const insertPayload = {
      device_id: deviceId,
      name,
      favorite_color: favoriteColor,
      magic_id: magicId,
      ...(stylistName && { stylist_name: stylistName }),
      ...(language && { language }),
      trial_used: false,
      // Legacy NOT NULL columns from the old daily-quota tier model. Backend
      // no longer reads these — kept here only so the INSERT succeeds while
      // the columns still exist on app_users. Once they're dropped via
      // ALTER TABLE ... DROP COLUMN, these two lines can go too.
      sessions_used_today: 0,
      last_session_date: new Date().toISOString().slice(0, 10),
    };

    const { data, error } = await eb.db.from<UserRow>(USERS_TABLE).insert(insertPayload);
    if (!error && data) {
      inserted = Array.isArray(data) ? (data[0] as UserRow) : (data as UserRow);
      break;
    }
    lastError = error ?? 'no data returned';
    const errString = String(lastError);
    // Retry only when the error specifically mentions the magic_id index/column;
    // anything else (device_id duplicate, FK error, …) bubbles up immediately.
    const isMagicIdCollision =
      errString.includes(MAGIC_ID_CONSTRAINT) || /magic[_-]?id/i.test(errString);
    if (!isMagicIdCollision) {
      throw new Error(`createUser failed: ${lastError}`);
    }
    logger.warn({ magicId, attempt, error: errString }, 'magic_id collision, retrying');
  }
  if (!inserted) {
    throw new Error(`createUser failed after retries: ${lastError}`);
  }
  logger.info({ deviceId }, 'User created');
  return stripRow(inserted) as UserProfile;
}

export async function getUserByMagicId(magicId: string): Promise<{ deviceId: string; profile: UserProfile } | null> {
  const eb = getEurobase();
  const { data, error } = await eb.db.from<UserRow>(USERS_TABLE).eq('magic_id', magicId).single();
  if (error) {
    if (/not found/i.test(error)) return null;
    throw new Error(`getUserByMagicId failed: ${error}`);
  }
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { deviceId: row.device_id, profile: stripRow(row) as UserProfile };
}

export async function setExpoPushToken(deviceId: string, token: string | null): Promise<void> {
  const eb = getEurobase();
  const lookup = await eb.db.from<UserRow>(USERS_TABLE).select('id').eq('device_id', deviceId).single();
  if (lookup.error || !lookup.data) {
    throw new NotFoundError('User not found');
  }
  const row = Array.isArray(lookup.data) ? lookup.data[0] : lookup.data;
  if (!row) throw new NotFoundError('User not found');
  const { error } = await eb.db.from(USERS_TABLE).update(row.id, { expo_push_token: token });
  if (error) throw new Error(`setExpoPushToken failed: ${error}`);
}

export async function getUser(deviceId: string): Promise<UserProfile | null> {
  const eb = getEurobase();
  const { data, error } = await eb.db.from<UserRow>(USERS_TABLE).eq('device_id', deviceId).single();
  if (error) {
    if (/not found/i.test(error)) return null;
    throw new Error(`getUser failed: ${error}`);
  }
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (stripRow(row) as UserProfile) : null;
}

export async function updateUser(
  deviceId: string,
  updates: Partial<Pick<UserProfile, 'name' | 'favorite_color' | 'stylist_name' | 'language'>>,
): Promise<UserProfile> {
  const eb = getEurobase();
  const lookup = await eb.db.from<UserRow>(USERS_TABLE).select('id').eq('device_id', deviceId).single();
  if (lookup.error || !lookup.data) {
    throw new NotFoundError('User not found');
  }
  const row = Array.isArray(lookup.data) ? lookup.data[0] : lookup.data;
  if (!row) throw new NotFoundError('User not found');

  const { error } = await eb.db.from<UserRow>(USERS_TABLE).update(row.id, updates);
  if (error) throw new Error(`updateUser failed: ${error}`);

  const fresh = await getUser(deviceId);
  if (!fresh) throw new NotFoundError('User not found');
  return fresh;
}

/**
 * Tester gating — either the device's UUID is on the backend allowlist,
 * or the request carries the `X-Tester-Secret` header value baked into
 * preview/internal builds via EXPO_PUBLIC_TESTER_SECRET. Production
 * builds don't ship the secret, so it can't be guessed without it.
 */
export function isTesterDevice(deviceId: string, headerSecret: string | undefined): boolean {
  const env = getEnv();
  if (env.TESTER_SECRET && headerSecret && headerSecret === env.TESTER_SECRET) {
    return true;
  }
  if (env.TESTER_DEVICE_IDS) {
    const ids = env.TESTER_DEVICE_IDS.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.includes(deviceId)) return true;
  }
  return false;
}

export type TierGateReason = 'trial_used' | 'monthly_cap';

export interface TierGateResult {
  allowed: boolean;
  reason?: TierGateReason;
  sessionsUsedThisMonth?: number;
  remaining?: number;
}

export async function incrementSessionCount(
  deviceId: string,
  tier: SubscriptionTier,
): Promise<TierGateResult> {
  const eb = getEurobase();

  const { data, error } = await eb.db.from<UserRow>(USERS_TABLE).eq('device_id', deviceId).single();
  if (error || !data) {
    throw new NotFoundError('User not found');
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new NotFoundError('User not found');

  if (tier === 'free') {
    if (row.trial_used) {
      return { allowed: false, reason: 'trial_used' };
    }
    const upd = await eb.db.from<UserRow>(USERS_TABLE).update(row.id, { trial_used: true });
    if (upd.error) throw new Error(`incrementSessionCount (trial) failed: ${upd.error}`);
    return { allowed: true };
  }

  // Tester + premium share the same monthly-cap logic, just with a
  // different cap. Trial gate doesn't apply to either.
  const env = getEnv();
  const cap = tier === 'tester' ? env.TESTER_MONTHLY_SESSION_CAP : env.MONTHLY_PREMIUM_SESSION_CAP;
  const monthStart = startOfMonthIso();

  const monthly = await eb.db
    .from<SessionRow>(SESSIONS_TABLE)
    .select('id')
    .eq('device_id', deviceId)
    .gte('start_time', monthStart);
  if (monthly.error) throw new Error(`incrementSessionCount (premium) failed: ${monthly.error}`);
  const used = Array.isArray(monthly.data) ? monthly.data.length : monthly.data ? 1 : 0;

  if (used >= cap) {
    return { allowed: false, reason: 'monthly_cap', sessionsUsedThisMonth: used, remaining: 0 };
  }
  return { allowed: true, sessionsUsedThisMonth: used + 1, remaining: cap - used - 1 };
}

// --- Sessions ---

export async function createSessionRecord(
  sessionId: string,
  deviceId: string,
  tier: SubscriptionTier,
): Promise<void> {
  const eb = getEurobase();
  const { error } = await eb.db.from<SessionRow>(SESSIONS_TABLE).insert({
    id: sessionId,
    device_id: deviceId,
    start_time: new Date().toISOString(),
    subscription_tier: tier,
    status: 'active',
  });
  if (error) throw new Error(`createSessionRecord failed: ${error}`);
}

export async function completeSessionRecord(
  sessionId: string,
  durationSeconds: number,
  status: 'completed' | 'expired',
): Promise<void> {
  const eb = getEurobase();
  const { error } = await eb.db.from<SessionRow>(SESSIONS_TABLE).update(sessionId, {
    end_time: new Date().toISOString(),
    duration_seconds: durationSeconds,
    status,
  });
  if (error) throw new Error(`completeSessionRecord failed: ${error}`);
}

// --- Session Memories ---

export async function saveSessionMemory(deviceId: string, memory: SessionMemory): Promise<void> {
  const eb = getEurobase();
  const { error } = await eb.db.from<MemoryRow>(MEMORIES_TABLE).insert({
    device_id: deviceId,
    session_id: memory.session_id,
    summary: memory.summary,
    ...(memory.tips !== undefined && { tips: memory.tips }),
    ...(memory.products !== undefined && { products: memory.products }),
    ...(memory.duration_seconds !== undefined && { duration_seconds: memory.duration_seconds }),
    ...(memory.occasion && { occasion: memory.occasion }),
  });
  if (error) throw new Error(`saveSessionMemory failed: ${error}`);
  logger.info({ deviceId, sessionId: memory.session_id }, 'Session memory saved');
}

export async function getRecentMemories(deviceId: string, limit = 3): Promise<SessionMemory[]> {
  return queryMemories(deviceId, limit);
}

export async function getSessionHistory(deviceId: string, limit = 20): Promise<SessionMemory[]> {
  return queryMemories(deviceId, limit);
}

async function queryMemories(deviceId: string, limit: number): Promise<SessionMemory[]> {
  const eb = getEurobase();
  const { data, error } = await eb.db
    .from<MemoryRow>(MEMORIES_TABLE)
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`queryMemories failed: ${error}`);
  if (!data) return [];
  const rows = Array.isArray(data) ? data : [data];
  return rows.map(row => stripRow(row) as SessionMemory);
}

export async function getSessionMemory(deviceId: string, sessionId: string): Promise<SessionMemory | null> {
  const eb = getEurobase();
  const { data, error } = await eb.db
    .from<MemoryRow>(MEMORIES_TABLE)
    .eq('device_id', deviceId)
    .eq('session_id', sessionId)
    .single();
  if (error) {
    if (/not found/i.test(error)) return null;
    throw new Error(`getSessionMemory failed: ${error}`);
  }
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (stripRow(row) as SessionMemory) : null;
}

/**
 * Look up a session memory by session_id alone and return both the memory and
 * the device_id of the owner. Used by the feed endpoint to authorize a
 * follower's request in one round trip + one isAcceptedFollower call.
 */
export async function findSessionMemoryWithOwner(
  sessionId: string,
): Promise<{ memory: SessionMemory; ownerDeviceId: string } | null> {
  const eb = getEurobase();
  const { data, error } = await eb.db
    .from<MemoryRow>(MEMORIES_TABLE)
    .eq('session_id', sessionId)
    .single();
  if (error) {
    if (/not found/i.test(error)) return null;
    throw new Error(`findSessionMemoryWithOwner failed: ${error}`);
  }
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { memory: stripRow(row) as SessionMemory, ownerDeviceId: row.device_id };
}

// --- Account deletion (Apple compliance) ---

/**
 * Hard-deletes the user's profile and every session + memory tied to their
 * device_id. Used by `DELETE /account`.
 *
 * Bulk deletes go through the Eurobase SQL endpoint via a small helper since
 * the SDK only exposes single-row .delete(id). Order doesn't matter — there
 * are no FKs; we just want all three tables wiped atomically.
 */
export async function deleteUserAndAllData(deviceId: string): Promise<void> {
  const eb = getEurobase();
  // Use the SDK's delete-by-id by listing each row first. Acceptable at v1
  // scale (sessions per user are bounded by the monthly cap × user lifetime).
  const sessions = await eb.db.from<SessionRow>(SESSIONS_TABLE).select('id').eq('device_id', deviceId);
  const sessionRows = Array.isArray(sessions.data) ? sessions.data : sessions.data ? [sessions.data] : [];
  for (const row of sessionRows) {
    if (row?.id) await eb.db.from(SESSIONS_TABLE).delete(row.id);
  }

  const memories = await eb.db.from<MemoryRow>(MEMORIES_TABLE).select('id').eq('device_id', deviceId);
  const memoryRows = Array.isArray(memories.data) ? memories.data : memories.data ? [memories.data] : [];
  for (const row of memoryRows) {
    if (row?.id) await eb.db.from(MEMORIES_TABLE).delete(row.id);
  }

  const images = await eb.db.from<SessionImageRow>(SESSION_IMAGES_TABLE).select('id').eq('device_id', deviceId);
  const imageRows = Array.isArray(images.data) ? images.data : images.data ? [images.data] : [];
  for (const row of imageRows) {
    if (row?.id) await eb.db.from(SESSION_IMAGES_TABLE).delete(row.id);
  }

  // Follow rows where this user is either side.
  const asFollower = await eb.db.from<FollowRow>(FOLLOWS_TABLE).select('id').eq('follower_device_id', deviceId);
  const asFollowerRows = Array.isArray(asFollower.data) ? asFollower.data : asFollower.data ? [asFollower.data] : [];
  for (const row of asFollowerRows) {
    if (row?.id) await eb.db.from(FOLLOWS_TABLE).delete(row.id);
  }
  const asFollowee = await eb.db.from<FollowRow>(FOLLOWS_TABLE).select('id').eq('followee_device_id', deviceId);
  const asFolloweeRows = Array.isArray(asFollowee.data) ? asFollowee.data : asFollowee.data ? [asFollowee.data] : [];
  for (const row of asFolloweeRows) {
    if (row?.id) await eb.db.from(FOLLOWS_TABLE).delete(row.id);
  }

  const user = await eb.db.from<UserRow>(USERS_TABLE).select('id').eq('device_id', deviceId).single();
  const userRow = Array.isArray(user.data) ? user.data[0] : user.data;
  if (userRow?.id) {
    await eb.db.from(USERS_TABLE).delete(userRow.id);
  }

  logger.info(
    {
      deviceId,
      sessionsDeleted: sessionRows.length,
      memoriesDeleted: memoryRows.length,
      imagesDeleted: imageRows.length,
      followsDeleted: asFollowerRows.length + asFolloweeRows.length,
    },
    'Account deleted',
  );
}

// --- Follows ---

export interface FollowSummary {
  id: string;
  status: FollowStatus;
  follower_device_id: string;
  followee_device_id: string;
  follower_name?: string;
  follower_magic_id?: string;
  followee_name?: string;
  followee_magic_id?: string;
  /** Nickname the follower assigned to the followee. Null if not set. */
  follower_alias?: string | null;
  created_at: string;
  responded_at?: string | null;
}

async function joinUserSummaries(rows: FollowRow[]): Promise<FollowSummary[]> {
  if (rows.length === 0) return [];
  const eb = getEurobase();
  const ids = Array.from(new Set(rows.flatMap(r => [r.follower_device_id, r.followee_device_id])));

  const lookups = await Promise.all(
    ids.map(async (deviceId) => {
      const { data } = await eb.db
        .from<UserRow>(USERS_TABLE)
        .select('device_id,name,magic_id')
        .eq('device_id', deviceId)
        .single();
      const row = Array.isArray(data) ? data[0] : data;
      return row ? { device_id: deviceId, name: row.name, magic_id: row.magic_id } : null;
    }),
  );
  const byDevice = new Map<string, { name: string; magic_id?: string }>();
  for (const u of lookups) {
    if (u) byDevice.set(u.device_id, { name: u.name, magic_id: u.magic_id });
  }

  return rows.map((r) => {
    const follower = byDevice.get(r.follower_device_id);
    const followee = byDevice.get(r.followee_device_id);
    return {
      id: r.id,
      status: r.status,
      follower_device_id: r.follower_device_id,
      followee_device_id: r.followee_device_id,
      ...(follower?.name && { follower_name: follower.name }),
      ...(follower?.magic_id && { follower_magic_id: follower.magic_id }),
      ...(followee?.name && { followee_name: followee.name }),
      ...(followee?.magic_id && { followee_magic_id: followee.magic_id }),
      follower_alias: r.follower_alias ?? null,
      created_at: r.created_at,
      responded_at: r.responded_at ?? null,
    };
  });
}

export interface CreateFollowResult {
  row: FollowRow;
  /** True if we created a brand-new row, false if we updated an existing one. */
  created: boolean;
  /**
   * True when the existing row was already in `denied` state and we
   * intentionally did NOT change anything. Callers should return success to
   * the requester (so the deny status isn't leaked) and skip the push.
   */
  silently_denied: boolean;
}

export async function createFollowRequest(
  followerDeviceId: string,
  followeeDeviceId: string,
  alias?: string | null,
): Promise<CreateFollowResult> {
  if (followerDeviceId === followeeDeviceId) {
    throw new ConflictError('Cannot follow yourself');
  }
  const eb = getEurobase();

  const trimmedAlias = alias?.trim() ? alias.trim() : null;

  const existing = await eb.db
    .from<FollowRow>(FOLLOWS_TABLE)
    .eq('follower_device_id', followerDeviceId)
    .eq('followee_device_id', followeeDeviceId)
    .single();
  if (!existing.error && existing.data) {
    const row = Array.isArray(existing.data) ? existing.data[0] : existing.data;
    if (row) {
      if (row.status === 'accepted') {
        // Already accepted — still let the follower update their nickname.
        if (trimmedAlias !== null && row.follower_alias !== trimmedAlias) {
          const upd = await eb.db.from(FOLLOWS_TABLE).update(row.id, { follower_alias: trimmedAlias });
          if (upd.error) throw new Error(`createFollowRequest alias update failed: ${upd.error}`);
          return { row: { ...row, follower_alias: trimmedAlias }, created: false, silently_denied: false };
        }
        throw new ConflictError('Already following this user');
      }
      if (row.status === 'denied') {
        // Treat deny as terminal-but-silent: leave the row untouched, suppress
        // the push, and report success to the requester. The followee can
        // delete the row later if they want to re-allow.
        return { row, created: false, silently_denied: true };
      }
      // pending: re-open with the latest alias and bump created_at
      const upd = await eb.db.from(FOLLOWS_TABLE).update(row.id, {
        status: 'pending',
        responded_at: null,
        created_at: new Date().toISOString(),
        ...(trimmedAlias !== null && { follower_alias: trimmedAlias }),
      });
      if (upd.error) throw new Error(`createFollowRequest update failed: ${upd.error}`);
      return {
        row: {
          ...row,
          status: 'pending',
          responded_at: null,
          follower_alias: trimmedAlias ?? row.follower_alias ?? null,
        },
        created: false,
        silently_denied: false,
      };
    }
  }

  const { data, error } = await eb.db.from<FollowRow>(FOLLOWS_TABLE).insert({
    follower_device_id: followerDeviceId,
    followee_device_id: followeeDeviceId,
    status: 'pending' as FollowStatus,
    ...(trimmedAlias !== null && { follower_alias: trimmedAlias }),
  });
  if (error || !data) throw new Error(`createFollowRequest failed: ${error ?? 'no data'}`);
  const row = Array.isArray(data) ? (data[0] as FollowRow) : (data as FollowRow);
  return { row, created: true, silently_denied: false };
}

export async function updateFollowerAlias(
  id: string,
  followerDeviceId: string,
  alias: string | null,
): Promise<FollowRow> {
  const eb = getEurobase();
  const row = await getFollowById(id);
  if (!row) throw new NotFoundError('Follow not found');
  if (row.follower_device_id !== followerDeviceId) {
    throw new NotFoundError('Follow not found');
  }
  const trimmed = alias?.trim() ? alias.trim() : null;
  const { error } = await eb.db.from(FOLLOWS_TABLE).update(row.id, { follower_alias: trimmed });
  if (error) throw new Error(`updateFollowerAlias failed: ${error}`);
  return { ...row, follower_alias: trimmed };
}

export async function getFollowById(id: string): Promise<FollowRow | null> {
  const eb = getEurobase();
  const { data, error } = await eb.db.from<FollowRow>(FOLLOWS_TABLE).eq('id', id).single();
  if (error) {
    if (/not found/i.test(error)) return null;
    throw new Error(`getFollowById failed: ${error}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export async function respondToFollow(
  id: string,
  followeeDeviceId: string,
  action: 'accept' | 'deny',
): Promise<FollowRow> {
  const eb = getEurobase();
  const row = await getFollowById(id);
  if (!row) throw new NotFoundError('Follow request not found');
  if (row.followee_device_id !== followeeDeviceId) {
    throw new NotFoundError('Follow request not found'); // 404 hides existence from non-target
  }
  if (row.status !== 'pending') {
    throw new ConflictError('Already responded to this request');
  }
  const newStatus: FollowStatus = action === 'accept' ? 'accepted' : 'denied';
  const upd = await eb.db.from(FOLLOWS_TABLE).update(row.id, {
    status: newStatus,
    responded_at: new Date().toISOString(),
  });
  if (upd.error) throw new Error(`respondToFollow failed: ${upd.error}`);
  return { ...row, status: newStatus, responded_at: new Date().toISOString() };
}

export async function deleteFollow(id: string, requesterDeviceId: string): Promise<void> {
  const eb = getEurobase();
  const row = await getFollowById(id);
  if (!row) throw new NotFoundError('Follow not found');
  if (row.follower_device_id !== requesterDeviceId && row.followee_device_id !== requesterDeviceId) {
    throw new NotFoundError('Follow not found');
  }
  const { error } = await eb.db.from(FOLLOWS_TABLE).delete(row.id);
  if (error) throw new Error(`deleteFollow failed: ${error}`);
}

export async function listPendingFollowsForFollowee(deviceId: string): Promise<FollowSummary[]> {
  const eb = getEurobase();
  const { data, error } = await eb.db
    .from<FollowRow>(FOLLOWS_TABLE)
    .eq('followee_device_id', deviceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listPendingFollowsForFollowee failed: ${error}`);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return joinUserSummaries(rows);
}

export async function listFollowing(deviceId: string): Promise<FollowSummary[]> {
  const eb = getEurobase();
  const { data, error } = await eb.db
    .from<FollowRow>(FOLLOWS_TABLE)
    .eq('follower_device_id', deviceId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listFollowing failed: ${error}`);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return joinUserSummaries(rows);
}

export async function listFollowers(deviceId: string): Promise<FollowSummary[]> {
  const eb = getEurobase();
  const { data, error } = await eb.db
    .from<FollowRow>(FOLLOWS_TABLE)
    .eq('followee_device_id', deviceId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listFollowers failed: ${error}`);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return joinUserSummaries(rows);
}

export async function getAcceptedFollowersDeviceIds(followeeDeviceId: string): Promise<string[]> {
  const eb = getEurobase();
  const { data, error } = await eb.db
    .from<FollowRow>(FOLLOWS_TABLE)
    .select('follower_device_id')
    .eq('followee_device_id', followeeDeviceId)
    .eq('status', 'accepted');
  if (error) throw new Error(`getAcceptedFollowersDeviceIds failed: ${error}`);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.map(r => r.follower_device_id);
}

export async function isAcceptedFollower(
  followerDeviceId: string,
  followeeDeviceId: string,
): Promise<boolean> {
  const eb = getEurobase();
  const { data, error } = await eb.db
    .from<FollowRow>(FOLLOWS_TABLE)
    .eq('follower_device_id', followerDeviceId)
    .eq('followee_device_id', followeeDeviceId)
    .eq('status', 'accepted')
    .single();
  if (error) {
    if (/not found/i.test(error)) return false;
    throw new Error(`isAcceptedFollower failed: ${error}`);
  }
  return !!data;
}

// --- Session Images (24h TTL) ---

export async function saveSessionImage(input: {
  sessionId: string;
  deviceId: string;
  storageUrl: string;
  mimeType: string;
  prompt: string;
  description?: string;
}): Promise<SessionImageRow> {
  const eb = getEurobase();
  const now = new Date();
  const expires = new Date(now.getTime() + IMAGE_TTL_HOURS * 60 * 60 * 1000);
  const { data, error } = await eb.db.from<SessionImageRow>(SESSION_IMAGES_TABLE).insert({
    session_id: input.sessionId,
    device_id: input.deviceId,
    storage_url: input.storageUrl,
    mime_type: input.mimeType,
    prompt: input.prompt,
    ...(input.description && { description: input.description }),
    expires_at: expires.toISOString(),
  });
  if (error || !data) throw new Error(`saveSessionImage failed: ${error ?? 'no data'}`);
  const row = Array.isArray(data) ? (data[0] as SessionImageRow) : (data as SessionImageRow);
  return row;
}

export async function getSessionImages(sessionId: string): Promise<SessionImageRow[]> {
  const eb = getEurobase();
  const nowIso = new Date().toISOString();
  const { data, error } = await eb.db
    .from<SessionImageRow>(SESSION_IMAGES_TABLE)
    .eq('session_id', sessionId)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`getSessionImages failed: ${error}`);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows;
}

export async function purgeExpiredSessionImages(): Promise<number> {
  const eb = getEurobase();
  const nowIso = new Date().toISOString();
  const { data, error } = await eb.db
    .from<SessionImageRow>(SESSION_IMAGES_TABLE)
    .select('id')
    .lte('expires_at', nowIso);
  if (error) throw new Error(`purgeExpiredSessionImages select failed: ${error}`);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  let purged = 0;
  for (const row of rows) {
    if (!row?.id) continue;
    const del = await eb.db.from(SESSION_IMAGES_TABLE).delete(row.id);
    if (!del.error) purged++;
  }
  return purged;
}

export async function getFollowedSessionFeed(
  followerDeviceId: string,
  limit = 30,
): Promise<Array<SessionMemory & {
  followee_device_id: string;
  followee_name?: string;
  follower_alias?: string | null;
  image_urls: string[];
}>> {
  const following = await listFollowing(followerDeviceId);
  if (following.length === 0) return [];

  const eb = getEurobase();

  // Fan out the memory fetches in parallel — Eurobase SDK has no IN(...)
  // operator so this is the closest we can get to a single round trip.
  const memoryFetches = await Promise.all(
    following.map(async (f) => {
      const { data, error } = await eb.db
        .from<MemoryRow>(MEMORIES_TABLE)
        .eq('device_id', f.followee_device_id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        logger.warn({ followee: f.followee_device_id, error }, 'feed: memory fetch failed');
        return { follow: f, rows: [] as MemoryRow[] };
      }
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return { follow: f, rows };
    }),
  );

  // Collect every session_id we're about to surface, then fetch all live
  // images in parallel and bucket them by session_id. One pass instead of
  // (followees × memories) serial round trips.
  const allSessionIds: string[] = [];
  for (const { rows } of memoryFetches) {
    for (const row of rows) allSessionIds.push(row.session_id);
  }

  const imagesBySession = new Map<string, SessionImageRow[]>();
  await Promise.all(
    allSessionIds.map(async (sessionId) => {
      const imgs = await getSessionImages(sessionId).catch(() => [] as SessionImageRow[]);
      imagesBySession.set(sessionId, imgs);
    }),
  );

  const results: Array<SessionMemory & {
    followee_device_id: string;
    followee_name?: string;
    follower_alias?: string | null;
    image_urls: string[];
  }> = [];
  for (const { follow: f, rows } of memoryFetches) {
    for (const row of rows) {
      const memory = stripRow(row) as SessionMemory;
      const images = imagesBySession.get(memory.session_id) ?? [];
      results.push({
        ...memory,
        followee_device_id: f.followee_device_id,
        ...(f.followee_name && { followee_name: f.followee_name }),
        follower_alias: f.follower_alias ?? null,
        image_urls: images.map((i) => i.storage_url),
      });
    }
  }

  results.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return results.slice(0, limit);
}

// --- Custom Errors ---

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
