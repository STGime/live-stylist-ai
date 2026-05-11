export interface UserProfile {
  device_id: string;
  name: string;
  favorite_color: string;
  stylist_name?: string;
  language?: string;
  trial_used?: boolean;
  created_at: string;
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

export type Occasion = 'casual' | 'work' | 'date_night' | 'event' | 'going_out' | 'selfcare';

export type AiState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'analyzing';
export type SessionEndReason = 'time' | 'manual' | 'error';
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

export interface FrameCrops {
  eyeCrop: string;
  mouthCrop: string;
  bodyCrop: string;
}

export interface AgentMaskState {
  eye: boolean;
  mouth: boolean;
  body: boolean;
}

export interface SessionHistoryItem {
  session_id: string;
  summary: string;
  tips?: string[];
  products?: ProductResult[];
  duration_seconds?: number;
  occasion?: Occasion;
  created_at: string;
}

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  LiveSession: {
    sessionId: string;
    expiryTime: number;
    wsUrl: string;
  };
  SessionSummary: {
    duration: number;
    reason: SessionEndReason;
    sessionsLeft: number;
    sessionId?: string;
  };
  SessionHistory: undefined;
  Paywall: { reason?: 'trial_used' | 'monthly_cap' | 'manual' } | undefined;
};
