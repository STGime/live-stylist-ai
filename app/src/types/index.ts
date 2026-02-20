export interface UserProfile {
  device_id: string;
  name: string;
  favorite_color: string;
  sessions_used_today: number;
  last_session_date: string;
  created_at: string;
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

export type AiState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type SessionEndReason = 'time' | 'manual' | 'error';

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  LiveSession: {
    sessionId: string;
    ephemeralToken: string;
    systemPrompt: string;
    expiryTime: number;
    geminiWsUrl: string;
    geminiModel: string;
  };
  SessionSummary: {
    duration: number;
    reason: SessionEndReason;
    sessionsLeft: number;
  };
};
