export interface UserProfile {
  device_id: string;
  name: string;
  favorite_color: string;
  stylist_name?: string;
  sessions_used_today: number;
  last_session_date: string;
  created_at: string;
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

export type AiState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'analyzing';
export type SessionEndReason = 'time' | 'manual' | 'error';

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
  };
};
