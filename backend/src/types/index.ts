import { z } from 'zod';

// --- User ---

// Format expected for stable_device_id: a UUID. iOS clients use a fresh
// uuidv4 persisted in Keychain (survives uninstall). Android clients
// derive a deterministic uuidv5 from Settings.Secure.ANDROID_ID + an
// app-private namespace, so the raw OS identifier never leaves the device.
const StableDeviceIdSchema = z.string().uuid().optional();

export const RegisterBodySchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
  favorite_color: z.string().min(1).max(30).regex(/^[a-zA-Z\s]+$/, 'Color contains invalid characters'),
  stylist_name: z.string().min(1).max(50).regex(/^[a-zA-Z\s'-]+$/, 'Stylist name contains invalid characters').optional(),
  language: z.string().regex(/^[a-z]{2}$/, 'Language must be a 2-letter code').optional(),
  stable_device_id: StableDeviceIdSchema,
});

export const LinkStableIdBodySchema = z.object({
  stable_device_id: z.string().uuid(),
});
export type LinkStableIdBody = z.infer<typeof LinkStableIdBodySchema>;

export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const UpdateProfileBodySchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters').optional(),
  favorite_color: z.string().min(1).max(30).regex(/^[a-zA-Z\s]+$/, 'Color contains invalid characters').optional(),
  stylist_name: z.string().min(1).max(50).regex(/^[a-zA-Z\s'-]+$/, 'Stylist name contains invalid characters').optional(),
  language: z.string().regex(/^[a-z]{2}$/, 'Language must be a 2-letter code').optional(),
}).refine(data => data.name || data.favorite_color || data.stylist_name || data.language, {
  message: 'At least one field must be provided',
});

export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>;

export interface UserProfile {
  name: string;
  favorite_color: string;
  stylist_name?: string;
  language?: string;
  created_at: string; // ISO 8601 (Postgres timestamptz)
  trial_used: boolean;
  magic_id?: string;
  expo_push_token?: string | null;
  stable_device_id?: string | null;
}

// --- Follows ---

export type FollowStatus = 'pending' | 'accepted' | 'denied';

export interface FollowRow {
  id: string;
  follower_device_id: string;
  followee_device_id: string;
  status: FollowStatus;
  follower_alias?: string | null;
  created_at: string;
  responded_at?: string | null;
}

// --- Blocks ---

export interface BlockRow {
  id: string;
  blocker_device_id: string;
  blocked_device_id: string;
  created_at: string;
}

// --- Session Images ---

export interface SessionImageRow {
  id: string;
  session_id: string;
  device_id: string;
  storage_url: string;
  mime_type: string;
  prompt: string;
  description?: string | null;
  created_at: string;
  expires_at: string;
}

// --- Occasion ---

export type Occasion = 'casual' | 'work' | 'date_night' | 'event' | 'going_out' | 'selfcare';

// 'free' = lifetime trial (1 session). 'premium' = paid subscription
// (monthly soft cap). 'tester' = internal / beta tester (higher monthly
// cap, no trial gate — see TESTER_DEVICE_IDS / TESTER_SECRET in env).
export type SubscriptionTier = 'free' | 'premium' | 'tester';

// --- Session ---

export interface SessionRecord {
  device_id: string;
  start_time: string; // ISO 8601
  end_time?: string;  // ISO 8601
  duration_seconds?: number;
  subscription_tier: SubscriptionTier;
  status: 'active' | 'completed' | 'expired';
}

export type ProductRegion = 'eu' | 'us';

export interface ProductResult {
  id: string;
  name: string;
  brand: string;
  price: string;
  currency: string;
  imageUrl: string;
  affiliateUrl: string;
  merchant: string;
  region: ProductRegion;
}

export interface ActiveSession {
  session_id: string;
  device_id: string;
  subscription_tier: SubscriptionTier;
  started_at: number; // Unix ms
  expires_at: number; // Unix ms
  occasion?: Occasion;
  region?: ProductRegion;
  warning_timer?: NodeJS.Timeout;
  expiry_timer?: NodeJS.Timeout;
  ws?: import('ws').WebSocket;
}

export interface StartSessionResponse {
  session_id: string;
  session_expiry_time: number;
  remaining_sessions_this_month: number | null;
  ws_url: string;
}

export interface EndSessionResponse {
  session_id: string;
  duration_seconds: number;
  reason: string;
}

// --- WebSocket Events ---

export type ServerEvent =
  | { type: 'session_started'; session_id: string; expires_at: number }
  | { type: 'session_ending_soon'; session_id: string; gemini_inject: string; seconds_remaining: number }
  | { type: 'session_expired'; session_id: string }
  | { type: 'session_ended'; session_id: string; duration_seconds: number; reason: string }
  | { type: 'audio'; data: string }
  | { type: 'state'; ai_state: AdkAiState }
  | { type: 'vision_active'; agents: string[] }
  | { type: 'transcript'; direction: 'input' | 'output'; text: string; finished: boolean }
  | { type: 'error'; message: string }
  | { type: 'pong' }
  | { type: 'preview_generating'; prompt: string }
  | { type: 'preview_image'; url: string; image?: string; mimeType: string; prompt: string; description?: string; trigger: 'agent' | 'client' }
  | { type: 'preview_error'; message: string; prompt: string }
  | { type: 'products'; products: ProductResult[] };

export type AdkAiState = 'listening' | 'thinking' | 'speaking' | 'analyzing' | 'idle';

export type ClientEvent =
  | { type: 'audio'; data: string }
  | { type: 'frame'; eye_crop: string; mouth_crop: string; body_crop: string }
  | { type: 'mute' }
  | { type: 'unmute' }
  | { type: 'end_session'; session_id: string }
  | { type: 'ping' };

export const ClientEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('audio'), data: z.string() }),
  z.object({ type: z.literal('frame'), eye_crop: z.string(), mouth_crop: z.string(), body_crop: z.string() }),
  z.object({ type: z.literal('mute') }),
  z.object({ type: z.literal('unmute') }),
  z.object({ type: z.literal('end_session'), session_id: z.string().uuid() }),
  z.object({ type: z.literal('ping') }),
]);

// --- Session Memory ---

export interface SessionMemory {
  session_id: string;
  summary: string;
  tips?: string[];
  products?: ProductResult[];
  duration_seconds?: number;
  occasion?: Occasion;
  created_at: string; // ISO 8601
}

// --- Express augmentation ---

declare global {
  namespace Express {
    interface Request {
      deviceId?: string;
    }
  }
}
