import { z } from 'zod';

// --- User ---

export const RegisterBodySchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
  favorite_color: z.string().min(1).max(30).regex(/^[a-zA-Z\s]+$/, 'Color contains invalid characters'),
  stylist_name: z.string().min(1).max(50).regex(/^[a-zA-Z\s'-]+$/, 'Stylist name contains invalid characters').optional(),
  language: z.string().regex(/^[a-z]{2}$/, 'Language must be a 2-letter code').optional(),
});

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
  created_at: FirebaseFirestore.Timestamp;
  sessions_used_today: number;
  last_session_date: string; // YYYY-MM-DD
}

// --- Occasion ---

export type Occasion = 'casual' | 'work' | 'date_night' | 'event' | 'going_out' | 'selfcare';

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
  occasion?: Occasion;
  warning_timer?: NodeJS.Timeout;
  expiry_timer?: NodeJS.Timeout;
  ws?: import('ws').WebSocket;
}

export interface StartSessionResponse {
  session_id: string;
  session_expiry_time: number;
  remaining_sessions_today: number;
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
  | { type: 'preview_image'; image: string; mimeType: string; prompt: string; description?: string; trigger: 'agent' | 'client' }
  | { type: 'preview_error'; message: string; prompt: string };

export type AdkAiState = 'listening' | 'thinking' | 'speaking' | 'analyzing' | 'idle';

export type ClientEvent =
  | { type: 'audio'; data: string }
  | { type: 'frame'; eye_crop: string; mouth_crop: string; body_crop: string }
  | { type: 'mute' }
  | { type: 'unmute' }
  | { type: 'end_session'; session_id: string }
  | { type: 'ping' }
  | { type: 'generate_preview'; prompt: string; category?: string };

export const ClientEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('audio'), data: z.string() }),
  z.object({ type: z.literal('frame'), eye_crop: z.string(), mouth_crop: z.string(), body_crop: z.string() }),
  z.object({ type: z.literal('mute') }),
  z.object({ type: z.literal('unmute') }),
  z.object({ type: z.literal('end_session'), session_id: z.string().uuid() }),
  z.object({ type: z.literal('ping') }),
  z.object({
    type: z.literal('generate_preview'),
    prompt: z.string().min(1).max(500),
    category: z.enum(['hairstyle', 'makeup', 'accessory', 'clothing', 'full_look']).optional(),
  }),
]);

// --- Session Memory ---

export interface SessionMemory {
  session_id: string;
  summary: string;
  tips?: string[];
  duration_seconds?: number;
  occasion?: Occasion;
  created_at: FirebaseFirestore.Timestamp;
}

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
