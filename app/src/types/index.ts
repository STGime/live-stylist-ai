export interface UserProfile {
  device_id: string;
  name: string;
  favorite_color: string;
  stylist_name?: string;
  language?: string;
  trial_used?: boolean;
  created_at: string;
  magic_id?: string;
  /** Whether the backend currently has a push token for this device. */
  notifications_enabled?: boolean;
  /** Whether this user row has been linked to a platform-stable id yet.
   *  When false on a returning user, the client should fire
   *  api.linkStableDeviceId() once so the next reinstall is recoverable. */
  has_stable_device_id?: boolean;
  /** Set by /register only when the backend recovered a prior install
   *  via stable_device_id (instead of creating a new row). */
  recovered?: boolean;
}

export type FollowStatus = 'pending' | 'accepted' | 'denied';

export interface FollowSummary {
  id: string;
  status: FollowStatus;
  follower_device_id: string;
  followee_device_id: string;
  follower_name?: string;
  follower_magic_id?: string;
  followee_name?: string;
  followee_magic_id?: string;
  /** Nickname the follower set for the followee. May be null. */
  follower_alias?: string | null;
  created_at: string;
  responded_at?: string | null;
}

export interface BlockSummary {
  id: string;
  blocked_device_id: string;
  blocked_name?: string;
  blocked_magic_id?: string;
  created_at: string;
}

export interface FeedItem {
  session_id: string;
  followee_device_id: string;
  followee_name?: string;
  follower_alias?: string | null;
  summary: string;
  tips?: string[];
  occasion?: Occasion;
  duration_seconds?: number;
  image_urls: string[];
  created_at: string;
}

export interface FollowedSessionDetail {
  session_id: string;
  followee_device_id: string;
  followee_name?: string;
  follower_alias?: string | null;
  summary: string;
  tips: string[];
  products: ProductResult[];
  duration_seconds?: number;
  occasion?: Occasion;
  created_at: string;
  images: Array<{
    url: string;
    mime_type: string;
    prompt: string;
    description: string | null;
    expires_at: string;
  }>;
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
  /** Storage URLs for the session's preview images while still within
   *  the 24h TTL. Rendered as an inline thumbnail strip on the past-
   *  sessions card, mirroring FeedScreen. */
  image_urls?: string[];
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
  Follow: undefined;
  Feed: undefined;
  FollowedSessionDetail: { sessionId: string };
  Paywall: { reason?: 'trial_used' | 'monthly_cap' | 'manual' } | undefined;
};
