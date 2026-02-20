import { getDeviceId } from './api';

const BASE_WS_URL = 'wss://livestylist-backend-833955805931.us-central1.run.app';

type ServerEvent =
  | { type: 'session_started'; session_id: string; expires_at: number }
  | { type: 'session_ending_soon'; session_id: string; gemini_inject: string; seconds_remaining: number }
  | { type: 'session_expired'; session_id: string }
  | { type: 'session_ended'; session_id: string; duration_seconds: number; reason: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

export type SessionEventHandler = (event: ServerEvent) => void;

export class SessionControlSocket {
  private ws: WebSocket | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private onEvent: SessionEventHandler;

  constructor(onEvent: SessionEventHandler) {
    this.onEvent = onEvent;
  }

  async connect(sessionId: string): Promise<void> {
    const deviceId = await getDeviceId();
    const url = `${BASE_WS_URL}/ws/session?session_id=${sessionId}&device_id=${deviceId}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // Start keepalive pings every 30s
        this.pingInterval = setInterval(() => {
          this.send({ type: 'ping' });
        }, 30000);
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as ServerEvent;
          this.onEvent(data);
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = () => {
        this.cleanup();
      };
    });
  }

  sendEndSession(sessionId: string): void {
    this.send({ type: 'end_session', session_id: sessionId });
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  disconnect(): void {
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }
}
