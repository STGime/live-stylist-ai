import * as admin from 'firebase-admin';
import { getDb } from '../config/firebase';
import { getEnv } from '../config/env';
import { logger } from '../utils/logger';
import type { UserProfile, SessionRecord, SubscriptionTier } from '../types';

const USERS_COLLECTION = 'users';
const SESSIONS_COLLECTION = 'sessions';

function todayDateString(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// --- Users ---

export async function createUser(deviceId: string, name: string, favoriteColor: string, stylistName?: string): Promise<UserProfile> {
  const db = getDb();
  const ref = db.collection(USERS_COLLECTION).doc(deviceId);

  const existing = await ref.get();
  if (existing.exists) {
    throw new ConflictError('User already registered');
  }

  const user: UserProfile = {
    name,
    favorite_color: favoriteColor,
    ...(stylistName && { stylist_name: stylistName }),
    created_at: admin.firestore.Timestamp.now(),
    sessions_used_today: 0,
    last_session_date: todayDateString(),
  };

  await ref.set(user);
  logger.info({ deviceId }, 'User created');
  return user;
}

export async function getUser(deviceId: string): Promise<UserProfile | null> {
  const db = getDb();
  const doc = await db.collection(USERS_COLLECTION).doc(deviceId).get();
  return doc.exists ? (doc.data() as UserProfile) : null;
}

export async function updateUser(deviceId: string, updates: Partial<Pick<UserProfile, 'name' | 'favorite_color' | 'stylist_name'>>): Promise<UserProfile> {
  const db = getDb();
  const ref = db.collection(USERS_COLLECTION).doc(deviceId);

  const doc = await ref.get();
  if (!doc.exists) {
    throw new NotFoundError('User not found');
  }

  await ref.update(updates);
  const updated = await ref.get();
  return updated.data() as UserProfile;
}

export async function incrementSessionCount(deviceId: string, tier: SubscriptionTier): Promise<{ allowed: boolean; sessionsUsedToday: number; remaining: number }> {
  const db = getDb();
  const env = getEnv();
  const ref = db.collection(USERS_COLLECTION).doc(deviceId);
  const limit = tier === 'premium' ? env.PREMIUM_SESSIONS_PER_DAY : env.FREE_SESSIONS_PER_DAY;
  const today = todayDateString();

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) {
      throw new NotFoundError('User not found');
    }

    const data = doc.data() as UserProfile;

    // Lazy daily reset
    let sessionsUsed = data.sessions_used_today;
    if (data.last_session_date !== today) {
      sessionsUsed = 0;
    }

    if (sessionsUsed >= limit) {
      return { allowed: false, sessionsUsedToday: sessionsUsed, remaining: 0 };
    }

    const newCount = sessionsUsed + 1;
    tx.update(ref, {
      sessions_used_today: newCount,
      last_session_date: today,
    });

    return { allowed: true, sessionsUsedToday: newCount, remaining: limit - newCount };
  });
}

// --- Sessions ---

export async function createSessionRecord(sessionId: string, deviceId: string, tier: SubscriptionTier): Promise<void> {
  const db = getDb();
  await db.collection(SESSIONS_COLLECTION).doc(sessionId).set({
    device_id: deviceId,
    start_time: admin.firestore.Timestamp.now(),
    subscription_tier: tier,
    status: 'active',
  } satisfies SessionRecord);
}

export async function completeSessionRecord(sessionId: string, durationSeconds: number, status: 'completed' | 'expired'): Promise<void> {
  const db = getDb();
  await db.collection(SESSIONS_COLLECTION).doc(sessionId).update({
    end_time: admin.firestore.Timestamp.now(),
    duration_seconds: durationSeconds,
    status,
  });
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
