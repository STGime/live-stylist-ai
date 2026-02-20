/**
 * Gemini Live API WebSocket client.
 * Connects to the BidiGenerateContent streaming endpoint for real-time
 * audio + video conversation.
 */

import { Buffer } from 'buffer';

export interface GeminiLiveCallbacks {
  onReady: () => void;
  onAudioChunk: (base64Pcm: string) => void;
  onTurnComplete: () => void;
  onInterrupted: () => void;
  onError: (error: string) => void;
  onClose: () => void;
}

export interface GeminiLiveConfig {
  geminiWsUrl: string;
  ephemeralToken: string;
  geminiModel: string;
  systemPrompt: string;
  callbacks: GeminiLiveCallbacks;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private config: GeminiLiveConfig;
  private setupComplete = false;

  constructor(config: GeminiLiveConfig) {
    this.config = config;
  }

  connect(): void {
    // Support both API key (key=) and ephemeral token (access_token=) auth
    const isApiKey = !this.config.ephemeralToken.startsWith('auth_tokens/');
    const authParam = isApiKey
      ? `key=${this.config.ephemeralToken}`
      : `access_token=${this.config.ephemeralToken}`;
    const url = `${this.config.geminiWsUrl}?${authParam}`;
    console.log('[GeminiLive] Connecting to:', url.substring(0, 80) + '...');
    this.ws = new WebSocket(url);
    // RN Android: binary frames come as base64 strings by default
    // Setting binaryType to 'blob' makes them arrive as Blob objects
    // Setting to 'arraybuffer' may not be supported — leave default and handle base64

    this.ws.onopen = () => {
      console.log('[GeminiLive] WebSocket opened, sending setup...');
      this.sendSetup();
    };

    this.ws.onmessage = (event: WebSocketMessageEvent) => {
      try {
        let text: string;
        const raw = event.data;

        if (typeof raw === 'string') {
          // Could be plain JSON or base64-encoded binary
          // Try JSON parse first; if it fails, try base64 decode
          try {
            const data = JSON.parse(raw);
            console.log('[GeminiLive] Received:', Object.keys(data).join(', '));
            this.handleMessage(data);
            return;
          } catch {
            // Not valid JSON string — try base64 decode
            text = Buffer.from(raw, 'base64').toString('utf-8');
          }
        } else if (raw instanceof ArrayBuffer) {
          text = Buffer.from(new Uint8Array(raw)).toString('utf-8');
        } else if (raw?.constructor?.name === 'Blob') {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(reader.result as string);
              console.log('[GeminiLive] Received (blob):', Object.keys(parsed).join(', '));
              this.handleMessage(parsed);
            } catch (e) {
              console.warn('[GeminiLive] Blob parse error:', e);
            }
          };
          reader.readAsText(raw);
          return;
        } else {
          console.log('[GeminiLive] Unknown data type:', typeof raw, raw?.constructor?.name);
          text = String(raw);
        }

        const data = JSON.parse(text);
        console.log('[GeminiLive] Received:', Object.keys(data).join(', '));
        this.handleMessage(data);
      } catch (e) {
        console.warn('[GeminiLive] Parse error:', e, 'type:', typeof event.data, 'constructor:', event.data?.constructor?.name, 'preview:', String(event.data).substring(0, 100));
        this.config.callbacks.onError('Failed to parse Gemini message');
      }
    };

    this.ws.onerror = (e: any) => {
      console.log('[GeminiLive] WebSocket error:', e?.message || e);
      this.config.callbacks.onError('Gemini WebSocket error');
    };

    this.ws.onclose = (e: any) => {
      console.log('[GeminiLive] WebSocket closed:', e?.code, e?.reason);
      this.config.callbacks.onClose();
    };
  }

  private sendSetup(): void {
    const model = this.config.geminiModel.startsWith('models/')
      ? this.config.geminiModel
      : `models/${this.config.geminiModel}`;
    console.log('[GeminiLive] Setup with model:', model);
    this.send({
      setup: {
        model,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede',
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: this.config.systemPrompt }],
        },
      },
    });
  }

  private handleMessage(data: any): void {
    // Setup complete acknowledgement
    if (data.setupComplete) {
      this.setupComplete = true;
      console.log('[GeminiLive] Setup complete!');
      this.config.callbacks.onReady();
      return;
    }

    const serverContent = data.serverContent;
    if (!serverContent) {
      return;
    }

    // Interruption
    if (serverContent.interrupted) {
      this.config.callbacks.onInterrupted();
      return;
    }

    // Model turn with audio data
    if (serverContent.modelTurn?.parts) {
      for (const part of serverContent.modelTurn.parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
          this.config.callbacks.onAudioChunk(part.inlineData.data);
        }
      }
    }

    // Turn complete
    if (serverContent.turnComplete) {
      this.config.callbacks.onTurnComplete();
    }
  }

  sendAudio(base64Pcm: string): void {
    if (!this.setupComplete) {
      return;
    }
    this.send({
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Pcm,
        },
      },
    });
  }

  sendVideo(base64Jpeg: string): void {
    if (!this.setupComplete) {
      return;
    }
    this.send({
      realtimeInput: {
        video: {
          mimeType: 'image/jpeg',
          data: base64Jpeg,
        },
      },
    });
  }

  sendText(text: string): void {
    if (!this.setupComplete) {
      return;
    }
    this.send({
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    });
  }

  disconnect(): void {
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
    this.setupComplete = false;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.setupComplete;
  }

  private send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
