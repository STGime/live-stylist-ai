import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { GoogleGenAI, Modality, Session as GeminiSession, LiveServerMessage } from '@google/genai';
import { buildCoordinatorInstruction } from '../agents/coordinator';
import { runVisionPipeline, formatVisionResults } from '../agents/visionPipeline';
import { logger } from '../utils/logger';
import { getEnv } from '../config/env';
import * as sessionManager from '../services/session-manager.service';
import * as firebaseService from '../services/firebase.service';

// Track active sessions for cleanup
const activeSessions = new Map<string, {
  geminiSession: GeminiSession;
}>();

interface ClientMessage {
  type: 'audio' | 'frame' | 'mute' | 'unmute' | 'end_session' | 'ping';
  data?: string;
  eye_crop?: string;
  mouth_crop?: string;
  body_crop?: string;
}

function sendToClient(ws: WebSocket, message: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function setupAdkWebSocket(wss: WebSocketServer): void {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const rawSessionId = url.searchParams.get('session_id');
    const rawDeviceId = url.searchParams.get('device_id');

    if (!rawSessionId || !rawDeviceId) {
      ws.close(4000, 'Missing session_id or device_id query parameter');
      return;
    }

    const sessionId = rawSessionId;
    const deviceId = rawDeviceId;

    // Verify session exists and belongs to device
    const session = sessionManager.getActiveSession(sessionId);
    if (!session) {
      ws.close(4001, 'Session not found or expired');
      return;
    }

    if (session.device_id !== deviceId) {
      ws.close(4003, 'Session does not belong to this device');
      return;
    }

    // Attach WebSocket to session manager (for timer events)
    sessionManager.attachWebSocket(sessionId, ws);

    logger.info({ sessionId, deviceId }, 'ADK WebSocket connected');

    // Load user profile for personalized agent
    let userProfile;
    try {
      userProfile = await firebaseService.getUser(deviceId);
      if (!userProfile) {
        ws.close(4004, 'User profile not found');
        return;
      }
    } catch (error) {
      logger.error({ error, deviceId }, 'Failed to load user profile');
      ws.close(4005, 'Failed to load user profile');
      return;
    }

    // Build system instruction for this user
    const systemInstruction = buildCoordinatorInstruction(userProfile);

    // Connect to Gemini Live API
    const env = getEnv();
    const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

    let geminiSession: GeminiSession;
    try {
      geminiSession = await genai.live.connect({
        model: 'gemini-2.5-flash-native-audio-latest',
        callbacks: {
          onopen: () => {
            logger.info({ sessionId }, 'Gemini Live session opened');
          },
          onmessage: (msg: LiveServerMessage) => {
            processGeminiMessage(msg, ws, sessionId);
          },
          onerror: (e: any) => {
            logger.error({ sessionId, error: e?.message || e }, 'Gemini Live error');
            sendToClient(ws, { type: 'error', message: 'AI session error' });
          },
          onclose: () => {
            logger.info({ sessionId }, 'Gemini Live session closed');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede',
              },
            },
          },
          systemInstruction: {
            role: 'user',
            parts: [{ text: systemInstruction }],
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });
    } catch (error: any) {
      logger.error({ sessionId, error: error.message, stack: error.stack }, 'Failed to connect Gemini Live');
      ws.close(4006, 'Failed to connect to AI');
      return;
    }

    activeSessions.set(sessionId, { geminiSession });

    // Track state
    let visionInProgress = false;
    let muted = false;
    let visionUpdateCount = 0;

    // Send session started
    sendToClient(ws, { type: 'session_started', session_id: sessionId });
    sendToClient(ws, { type: 'state', ai_state: 'listening' });

    // Trigger greeting — send a prompt so the agent introduces itself
    geminiSession.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{ text: '[Session started. Greet the user warmly and introduce yourself. Do NOT describe what you see or mention any clothing/appearance details yet — you have not received any visual data.]' }],
      }],
      turnComplete: true,
    });

    // --- UPSTREAM: Handle client messages ---
    let msgCount = 0;
    ws.on('message', (data) => {
      try {
        msgCount++;
        const raw = data.toString();
        if (msgCount <= 5 || msgCount % 50 === 0) {
          logger.info({ sessionId, msgCount, msgType: raw.substring(0, 30), rawLen: raw.length }, 'WS message received');
        }
        const msg: ClientMessage = JSON.parse(raw);

        switch (msg.type) {
          case 'audio':
            if (msg.data && !muted) {
              geminiSession.sendRealtimeInput({
                audio: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: msg.data,
                },
              });
            }
            break;

          case 'frame':
            logger.info({
              sessionId,
              hasEye: !!msg.eye_crop,
              hasMouth: !!msg.mouth_crop,
              hasBody: !!msg.body_crop,
              eyeLen: msg.eye_crop?.length ?? 0,
              visionInProgress,
            }, 'Frame received from client');
            if (msg.eye_crop && msg.mouth_crop && msg.body_crop) {
              if (!visionInProgress) {
                triggerVisionAnalysis(msg.eye_crop, msg.mouth_crop, msg.body_crop);
              }
            }
            break;

          case 'mute':
            muted = true;
            break;

          case 'unmute':
            muted = false;
            break;

          case 'end_session':
            sessionManager.endSession(sessionId, 'manual').catch(err => {
              logger.error({ sessionId, error: err }, 'Error ending session');
            });
            break;

          case 'ping':
            sendToClient(ws, { type: 'pong' });
            break;
        }
      } catch (error) {
        logger.warn({ sessionId, error }, 'Invalid WebSocket message');
      }
    });

    // Run vision pipeline directly, then inject results as text into coordinator
    async function triggerVisionAnalysis(eyeCrop: string, mouthCrop: string, bodyCrop: string) {
      visionInProgress = true;
      logger.info({ sessionId, eyeLen: eyeCrop.length, mouthLen: mouthCrop.length, bodyLen: bodyCrop.length }, 'Starting vision pipeline');
      sendToClient(ws, { type: 'vision_active', agents: ['eye', 'mouth', 'body'] });
      sendToClient(ws, { type: 'state', ai_state: 'analyzing' });

      try {
        // Call 3 vision agents in parallel via direct Gemini API
        const results = await runVisionPipeline(eyeCrop, mouthCrop, bodyCrop);

        // Inject vision results into conversation context.
        // First update: use turnComplete: true so the model sees initial appearance.
        // Subsequent updates: use turnComplete: false so they don't trigger responses —
        // the model will reference the latest data when the user next speaks.
        visionUpdateCount++;
        const isFirstVision = visionUpdateCount === 1;
        const resultText = formatVisionResults(results);
        geminiSession.sendClientContent({
          turns: [{
            role: 'user',
            parts: [{ text: resultText }],
          }],
          turnComplete: isFirstVision,
        });

        sendToClient(ws, { type: 'vision_active', agents: [] });
        logger.info({ sessionId }, 'Vision results injected into coordinator');
      } catch (error) {
        logger.error({ sessionId, error }, 'Vision pipeline failed');
        sendToClient(ws, { type: 'vision_active', agents: [] });
      } finally {
        // Cooldown before next vision analysis (10s to avoid flooding context)
        setTimeout(() => {
          visionInProgress = false;
        }, 10000);
      }
    }

    // --- CLEANUP ---
    ws.on('close', (code, reason) => {
      logger.info({ sessionId, code, reason: reason.toString() }, 'ADK WebSocket closed');
      cleanup();
    });

    ws.on('error', (error) => {
      logger.error({ sessionId, error }, 'ADK WebSocket error');
      cleanup();
    });

    function cleanup() {
      try {
        geminiSession.close();
      } catch (_) { /* ignore close errors */ }
      activeSessions.delete(sessionId);
    }
  });
}

/**
 * Process a Gemini Live server message and forward relevant data to the client.
 */
function processGeminiMessage(msg: LiveServerMessage, ws: WebSocket, sessionId: string): void {
  // Handle server content (audio, text, transcriptions)
  if (msg.serverContent) {
    const content = msg.serverContent;

    // Model turn — audio and text parts
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
          sendToClient(ws, {
            type: 'audio',
            data: part.inlineData.data,
          });
          sendToClient(ws, { type: 'state', ai_state: 'speaking' });
        }

        if (part.text) {
          sendToClient(ws, {
            type: 'transcript',
            direction: 'output',
            text: part.text,
            finished: false,
          });
        }
      }
    }

    // Input transcription
    if (content.inputTranscription?.text) {
      sendToClient(ws, {
        type: 'transcript',
        direction: 'input',
        text: content.inputTranscription.text,
        finished: false,
      });
    }

    // Output transcription
    if (content.outputTranscription?.text) {
      sendToClient(ws, {
        type: 'transcript',
        direction: 'output',
        text: content.outputTranscription.text,
        finished: false,
      });
    }

    // Turn complete
    if (content.turnComplete) {
      sendToClient(ws, { type: 'state', ai_state: 'listening' });
      sendToClient(ws, {
        type: 'transcript',
        direction: 'output',
        text: '',
        finished: true,
      });
    }

    // Interrupted
    if (content.interrupted) {
      sendToClient(ws, { type: 'state', ai_state: 'listening' });
    }
  }

  // Setup complete
  if (msg.setupComplete) {
    logger.info({ sessionId }, 'Gemini Live setup complete');
  }
}

/**
 * Shutdown all active sessions.
 */
export function shutdownAdkSessions(): void {
  for (const [sessionId, session] of activeSessions) {
    logger.info({ sessionId }, 'Shutting down Gemini Live session');
    try {
      session.geminiSession.close();
    } catch (_) { /* ignore */ }
  }
  activeSessions.clear();
}
