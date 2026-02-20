import { z } from 'zod';

// --- User ---

export const RegisterBodySchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
  favorite_color: z.string().min(1).max(30).regex(/^[a-zA-Z\s]+$/, 'Color contains invalid characters'),
});

export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const UpdateProfileBodySchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters').optional(),
  favorite_color: z.string().min(1).max(30).regex(/^[a-zA-Z\s]+$/, 'Color contains invalid characters').optional(),
}).refine(data => data.name || data.favorite_color, {
  message: 'At least one field must be provided',
});

export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>;

export interface UserProfile {
  name: string;
  favorite_color: string;
  created_at: FirebaseFirestore.Timestamp;
  sessions_used_today: number;
  last_session_date: string; // YYYY-MM-DD
}

// --- Session ---

export interface SessionRecord {
  device_id: string;
  start_time: FirebaseFirestore.Timestamp;
  end_time?: FirebaseFirestore.Timestamp;
  duration_seconds?: number;
  subscription_tier: 'free' | 'premium';
  status: 'active' | 'completed' | 'expired';
}

export interface ActiveSession {
  session_id: string;
  device_id: string;
  subscription_tier: 'free' | 'premium';
  started_at: number; // Unix ms
  expires_at: number; // Unix ms
  warning_timer?: NodeJS.Timeout;
  expiry_timer?: NodeJS.Timeout;
  ws?: import('ws').WebSocket;
}

export interface StartSessionResponse {
  session_id: string;
  ephemeral_token: string;
  system_prompt: string;
  session_expiry_time: number;
  remaining_sessions_today: number;
  gemini_model: string;
  gemini_ws_url: string;
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
  | { type: 'error'; message: string }
  | { type: 'pong' };

export type ClientEvent =
  | { type: 'end_session'; session_id: string }
  | { type: 'ping' };

export const ClientEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('end_session'), session_id: z.string().uuid() }),
  z.object({ type: z.literal('ping') }),
]);

// --- Subscription ---

export type SubscriptionTier = 'free' | 'premium';

// --- Express augmentation ---

declare global {
  namespace Express {
    interface Request {
      deviceId?: string;
    }
  }
}
