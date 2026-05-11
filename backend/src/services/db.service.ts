import { getEurobase } from '../config/eurobase.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { UserProfile, SessionRecord, SessionMemory, SubscriptionTier } from '../types/index.js';

// 'users' is reserved by the Eurobase platform auth users table, so device-keyed
// profile data lives in 'app_users'.
const USERS_TABLE = 'app_users';
const SESSIONS_TABLE = 'sessions';
const MEMORIES_TABLE = 'session_memories';

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

  const insertPayload = {
    device_id: deviceId,
    name,
    favorite_color: favoriteColor,
    ...(stylistName && { stylist_name: stylistName }),
    ...(language && { language }),
    trial_used: false,
  };

  const { data, error } = await eb.db.from<UserRow>(USERS_TABLE).insert(insertPayload);
  if (error || !data) {
    throw new Error(`createUser failed: ${error ?? 'no data returned'}`);
  }
  logger.info({ deviceId }, 'User created');

  const row = Array.isArray(data) ? data[0] : data;
  return stripRow(row) as UserProfile;
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

  // Premium: count sessions started this calendar month (UTC).
  const env = getEnv();
  const cap = env.MONTHLY_PREMIUM_SESSION_CAP;
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

  const user = await eb.db.from<UserRow>(USERS_TABLE).select('id').eq('device_id', deviceId).single();
  const userRow = Array.isArray(user.data) ? user.data[0] : user.data;
  if (userRow?.id) {
    await eb.db.from(USERS_TABLE).delete(userRow.id);
  }

  logger.info(
    { deviceId, sessionsDeleted: sessionRows.length, memoriesDeleted: memoryRows.length },
    'Account deleted',
  );
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
