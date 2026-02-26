import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import type { UserProfile, StartSessionResponse, EndSessionResponse, Occasion, SessionHistoryItem } from '../types';

const BASE_URL = 'https://livestylist-backend-833955805931.us-central1.run.app';
const DEVICE_ID_KEY = '@livestylist_device_id';

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
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  const data = await response.json();

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
export function startSession(occasion?: Occasion) {
  return apiRequest<StartSessionResponse>('POST', '/start-session', occasion ? { occasion } : undefined);
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
