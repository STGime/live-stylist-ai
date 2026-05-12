import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import type {
  UserProfile,
  StartSessionResponse,
  EndSessionResponse,
  Occasion,
  SessionHistoryItem,
  ProductRegion,
  FollowSummary,
  FeedItem,
  FollowedSessionDetail,
  BlockSummary,
} from '../types';

const BASE_URL = 'https://livestylist-backend-833955805931.us-central1.run.app';
const DEVICE_ID_KEY = '@livestylist_device_id';
// Baked in at build time via eas.json env (preview / development profiles
// only — production profile leaves it unset, so App Store / TestFlight
// builds never identify as testers). When set, every request includes
// `X-Tester-Secret` and the backend grants the tester monthly cap.
const TESTER_SECRET: string | undefined = process.env.EXPO_PUBLIC_TESTER_SECRET;

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = uuidv4();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  cachedDeviceId = deviceId;
  return deviceId;
}

export async function hasDeviceId(): Promise<boolean> {
  const id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  return id !== null;
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const deviceId = await getDeviceId();

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Device-ID': deviceId,
      ...(TESTER_SECRET ? { 'X-Tester-Secret': TESTER_SECRET } : {}),
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  // 204 No Content (e.g. DELETE /account) has an empty body — JSON.parse on
  // "" throws "unexpected end of input", so read as text first.
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed') as Error & {
      status: number;
      code: string;
    };
    error.status = response.status;
    error.code = data.error;
    throw error;
  }

  return data as T;
}

// Account deletion (Apple-required). Wipes server-side data first, then
// clears the local device id + storage so the next launch starts onboarding.
export async function deleteAccount(): Promise<void> {
  await apiRequest<void>('DELETE', '/account');
  cachedDeviceId = null;
  await AsyncStorage.clear();
}

// User
export function register(name: string, favoriteColor: string, stylistName?: string, language?: string) {
  return apiRequest<UserProfile>('POST', '/register', {
    name,
    favorite_color: favoriteColor,
    ...(stylistName && { stylist_name: stylistName }),
    ...(language && { language }),
  });
}

export function getProfile() {
  return apiRequest<UserProfile>('GET', '/profile');
}

export function updateProfile(updates: { name?: string; favorite_color?: string; stylist_name?: string; language?: string }) {
  return apiRequest<UserProfile>('PUT', '/profile', updates);
}

// Sessions
export function startSession(occasion?: Occasion, region?: ProductRegion) {
  const body: Record<string, unknown> = {};
  if (occasion) body.occasion = occasion;
  if (region) body.region = region;
  return apiRequest<StartSessionResponse>('POST', '/start-session', Object.keys(body).length > 0 ? body : undefined);
}

export function endSession(sessionId: string) {
  return apiRequest<EndSessionResponse>('POST', '/end-session', {
    session_id: sessionId,
  });
}

// Session History
export function getSessionHistory() {
  return apiRequest<SessionHistoryItem[]>('GET', '/session-history');
}

export function getSessionSummary(sessionId: string) {
  return apiRequest<SessionHistoryItem>('GET', `/session-summary/${sessionId}`);
}

// Magic ID + push token
export function getMyMagicId() {
  return apiRequest<{ magic_id: string }>('GET', '/me/magic-id');
}

export function registerPushToken(token: string) {
  return apiRequest<void>('POST', '/me/push-token', { token });
}

export function clearPushToken() {
  return apiRequest<void>('DELETE', '/me/push-token');
}

// Follow graph
export function requestFollow(magicId: string, alias?: string | null) {
  const body: Record<string, unknown> = { magic_id: magicId };
  if (alias !== undefined) body.alias = alias;
  return apiRequest<{ id: string; status: 'pending' | 'accepted' | 'denied'; followee: { name: string; magic_id?: string } }>(
    'POST',
    '/follows/request',
    body,
  );
}

export function updateFollowAlias(id: string, alias: string | null) {
  return apiRequest<{ id: string; follower_alias: string | null }>(
    'PATCH',
    `/follows/${id}/alias`,
    { alias },
  );
}

export function respondToFollow(id: string, action: 'accept' | 'deny') {
  return apiRequest<{ id: string; status: 'accepted' | 'denied' }>('POST', `/follows/${id}/respond`, { action });
}

export function unfollow(id: string) {
  return apiRequest<void>('DELETE', `/follows/${id}`);
}

export function listPendingFollows() {
  return apiRequest<FollowSummary[]>('GET', '/follows/pending');
}

export function listFollowing() {
  return apiRequest<FollowSummary[]>('GET', '/follows/following');
}

export function listFollowers() {
  return apiRequest<FollowSummary[]>('GET', '/follows/followers');
}

// Feed
export function getFeed() {
  return apiRequest<FeedItem[]>('GET', '/feed');
}

export function getFollowedSession(sessionId: string) {
  return apiRequest<FollowedSessionDetail>('GET', `/feed/sessions/${sessionId}`);
}

// Blocks
export function listBlocks() {
  return apiRequest<BlockSummary[]>('GET', '/blocks');
}

export function blockByMagicId(magicId: string) {
  return apiRequest<BlockSummary>('POST', '/blocks', { magic_id: magicId });
}

export function blockByFollowId(followId: string) {
  return apiRequest<BlockSummary>('POST', '/blocks', { follow_id: followId });
}

export function unblock(id: string) {
  return apiRequest<void>('DELETE', `/blocks/${id}`);
}
