/**
 * ADK Session WebSocket client.
 * Connects to the backend ADK endpoint for real-time audio + vision conversation.
 * Replaces the old direct-to-Gemini GeminiLiveClient.
 */

export type AdkAiState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'analyzing';

export interface PreviewImageData {
  image: string;
  mimeType: string;
  prompt: string;
  description?: string;
  trigger: 'agent' | 'client';
}

export interface ProductResult {
  id: string;
  name: string;
  brand: string;
  price: string;
  currency: string;
  imageUrl: string;
  affiliateUrl: string;
  merchant: string;
  region: 'eu' | 'us';
}

export interface AdkSessionCallbacks {
  onReady: () => void;
  onAudioChunk: (base64Pcm: string) => void;
  onStateChange: (state: AdkAiState) => void;
  onVisionActive: (agents: string[]) => void;
  onTranscript: (direction: 'input' | 'output', text: string, finished: boolean) => void;
  onSessionEvent: (event: SessionEvent) => void;
  onPreviewGenerating?: (prompt: string) => void;
  onPreviewImage?: (data: PreviewImageData) => void;
  onPreviewError?: (data: { message: string; prompt: string }) => void;
  onProducts?: (products: ProductResult[]) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

export type SessionEvent =
  | { type: 'session_started'; session_id: string }
  | { type: 'session_ending_soon'; session_id: string; gemini_inject: string; seconds_remaining: number }
  | { type: 'session_expired'; session_id: string }
  | { type: 'session_ended'; session_id: string; duration_seconds: number; reason: string };

export interface AdkSessionConfig {
  wsUrl: string;
  callbacks: AdkSessionCallbacks;
}

export class AdkSessionClient {
  private ws: WebSocket | null = null;
  private config: AdkSessionConfig;
  private ready = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private static readonly MAX_RECONNECT_ATTEMPTS = 1;
  private static readonly RECONNECT_DELAY_MS = 1000;

  constructor(config: AdkSessionConfig) {
    this.config = config;
  }

  connect(): void {
    const isReconnect = this.reconnectAttempts > 0;
    console.log(
      `[AdkClient] ${isReconnect ? 'Reconnecting' : 'Connecting'} to:`,
      this.config.wsUrl.substring(0, 80) + '...',
    );
    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.onopen = () => {
      console.log('[AdkClient] WebSocket opened');
      this.ready = true;
      this.reconnectAttempts = 0; // Reset on successful open
      this.config.callbacks.onReady();

      // Start keepalive pings every 25s
      this.pingInterval = setInterval(() => {
        this.send({ type: 'ping' });
      }, 25000);
    };

    this.ws.onmessage = (event: WebSocketMessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        this.handleMessage(data);
      } catch (e) {
        console.warn('[AdkClient] Parse error:', e);
      }
    };

    this.ws.onerror = (e: any) => {
      console.log('[AdkClient] WebSocket error:', e?.message || e);
      this.config.callbacks.onError('Connection error');
    };

    this.ws.onclose = (e: any) => {
      console.log('[AdkClient] WebSocket closed:', e?.code, e?.reason);
      this.ready = false;
      this.cleanup();

      const abnormal = !this.intentionalClose && e?.code !== 1000;
      if (abnormal && this.reconnectAttempts < AdkSessionClient.MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts += 1;
        console.log(`[AdkClient] Attempting reconnect ${this.reconnectAttempts}/${AdkSessionClient.MAX_RECONNECT_ATTEMPTS} in ${AdkSessionClient.RECONNECT_DELAY_MS}ms`);
        setTimeout(() => {
          if (!this.intentionalClose) this.connect();
        }, AdkSessionClient.RECONNECT_DELAY_MS);
        return;
      }

      this.config.callbacks.onClose();
    };
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'audio':
        if (data.data) {
          this.config.callbacks.onAudioChunk(data.data);
        }
        break;

      case 'state':
        this.config.callbacks.onStateChange(data.ai_state);
        break;

      case 'vision_active':
        this.config.callbacks.onVisionActive(data.agents || []);
        break;

      case 'transcript':
        this.config.callbacks.onTranscript(data.direction, data.text, data.finished);
        break;

      case 'session_started':
      case 'session_ending_soon':
      case 'session_expired':
      case 'session_ended':
        this.config.callbacks.onSessionEvent(data);
        break;

      case 'preview_generating':
        this.config.callbacks.onPreviewGenerating?.(data.prompt);
        break;

      case 'preview_image':
        this.config.callbacks.onPreviewImage?.({
          image: data.image,
          mimeType: data.mimeType,
          prompt: data.prompt,
          description: data.description,
          trigger: data.trigger,
        });
        break;

      case 'preview_error':
        this.config.callbacks.onPreviewError?.({
          message: data.message,
          prompt: data.prompt,
        });
        break;

      case 'products':
        if (data.products && Array.isArray(data.products)) {
          this.config.callbacks.onProducts?.(data.products);
        }
        break;

      case 'error':
        this.config.callbacks.onError(data.message || 'Unknown error');
        break;

      case 'pong':
        break;

      default:
        console.log('[AdkClient] Unknown message type:', JSON.stringify(data.type), 'keys:', Object.keys(data));
    }
  }

  sendAudio(base64Pcm: string): void {
    if (!this.ready) return;
    this.send({ type: 'audio', data: base64Pcm });
  }

  sendFrame(eyeCrop: string, mouthCrop: string, bodyCrop: string): void {
    if (!this.ready) return;
    this.send({
      type: 'frame',
      eye_crop: eyeCrop,
      mouth_crop: mouthCrop,
      body_crop: bodyCrop,
    });
  }

  sendMute(): void {
    this.send({ type: 'mute' });
  }

  sendUnmute(): void {
    this.send({ type: 'unmute' });
  }

  sendEndSession(): void {
    this.send({ type: 'end_session' });
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.cleanup();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }
    this.ready = false;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.ready;
  }

  private send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
