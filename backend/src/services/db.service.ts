import { getEurobase } from '../config/eurobase.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { UserProfile, SessionRecord, SessionMemory, SubscriptionTier } from '../types/index.js';

// 'users' is reserved by the Eurobase platform auth users table, so device-keyed
// profile data lives in 'app_users'.
const USERS_TABLE = 'app_users';
const SESSIONS_TABLE = 'sessions';
const MEMORIES_TABLE = 'session_memories';

function todayDateString(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
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
    sessions_used_today: 0,
    last_session_date: todayDateString(),
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

export async function incrementSessionCount(
  deviceId: string,
  tier: SubscriptionTier,
): Promise<{ allowed: boolean; sessionsUsedToday: number; remaining: number }> {
  const eb = getEurobase();
  const env = getEnv();
  const limit = tier === 'premium' ? env.PREMIUM_SESSIONS_PER_DAY : env.FREE_SESSIONS_PER_DAY;
  const today = todayDateString();

  const { data, error } = await eb.db.from<UserRow>(USERS_TABLE).eq('device_id', deviceId).single();
  if (error || !data) {
    throw new NotFoundError('User not found');
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new NotFoundError('User not found');

  // Lazy daily reset
  let sessionsUsed = row.sessions_used_today;
  if (row.last_session_date !== today) {
    sessionsUsed = 0;
  }

  if (sessionsUsed >= limit) {
    return { allowed: false, sessionsUsedToday: sessionsUsed, remaining: 0 };
  }

  const newCount = sessionsUsed + 1;
  const upd = await eb.db.from<UserRow>(USERS_TABLE).update(row.id, {
    sessions_used_today: newCount,
    last_session_date: today,
  });
  if (upd.error) throw new Error(`incrementSessionCount failed: ${upd.error}`);

  return { allowed: true, sessionsUsedToday: newCount, remaining: limit - newCount };
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
