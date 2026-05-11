import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { GoogleGenAI, Modality, Session as GeminiSession, LiveServerMessage } from '@google/genai';
import { buildCoordinatorInstruction } from '../agents/coordinator.js';
import { runVisionPipeline, formatVisionResults } from '../agents/visionPipeline.js';
import { logger } from '../utils/logger.js';
import { getEnv } from '../config/env.js';
import * as sessionManager from '../services/session-manager.service.js';
import * as dbService from '../services/db.service.js';
import { generateStylePreview } from '../services/image-generation.service.js';
import type { GenerationRequest } from '../services/image-generation.service.js';
import { searchProducts, type ProductResult } from '../services/awin-product-search.js';
import { ProductTriggerCooldown } from '../services/product-trigger.js';
import * as push from '../services/push.service.js';

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

    // Capture session data for cleanup closure
    const sessionStartedAt = session.started_at;
    const sessionOccasion = session.occasion;

    // Attach WebSocket to session manager (for timer events)
    sessionManager.attachWebSocket(sessionId, ws);

    logger.info({ sessionId, deviceId }, 'ADK WebSocket connected');

    // Load user profile for personalized agent
    let userProfile;
    try {
      userProfile = await dbService.getUser(deviceId);
      if (!userProfile) {
        ws.close(4004, 'User profile not found');
        return;
      }
    } catch (error) {
      logger.error({ error, deviceId }, 'Failed to load user profile');
      ws.close(4005, 'Failed to load user profile');
      return;
    }

    const userLanguage = userProfile.language;

    // Load past session memories for continuity
    let memories: import('../types/index.js').SessionMemory[] = [];
    try {
      memories = await dbService.getRecentMemories(deviceId, 3);
      if (memories.length > 0) {
        logger.info({ sessionId, deviceId, memoryCount: memories.length }, 'Loaded past session memories');
      }
    } catch (error) {
      logger.warn({ error, deviceId }, 'Failed to load session memories, continuing without');
    }

    // Build system instruction for this user
    const systemInstruction = buildCoordinatorInstruction(userProfile, memories, session.occasion);

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
            processGeminiMessage(msg, ws, sessionId, sessionLog, checkForPreviewTrigger, checkBufferOnTurnComplete, checkForProductTrigger, (speaking) => { agentSpeaking = speaking; });
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
    let agentSpeaking = false;
    let visionUpdateCount = 0;
    let greetingComplete = false; // Set true after first turn completes (greeting finished)
    let pendingVisionResult: string | null = null; // Buffer vision results until greeting done
    const sessionLog: string[] = [];
    let latestBodyCrop: string | null = null;
    let previewInProgress = false;
    let previewResetTimer: NodeJS.Timeout | null = null;
    let transcriptBuffer = '';
    let previewCooldownUntil = 0; // Timestamp: ignore preview triggers until this time

    const PREVIEW_TIMEOUT_MS = 60000;

    // Product recommendation state
    const productTrigger = new ProductTriggerCooldown(15000);
    const shownProducts: ProductResult[] = [];
    const sessionRegion = session.region || 'us';

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
            // Always forward mic audio when not muted; Gemini Live's BIDI
            // stream emits `interrupted` when it detects the user speaking
            // over the agent, which the message handler below converts into
            // a `state: 'listening'` event the client uses to flush its
            // playback queue. AEC on the client mic source prevents the
            // agent's own voice from feeding back.
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
            if (msg.body_crop) {
              latestBodyCrop = msg.body_crop;
            }
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

        if (isFirstVision && !greetingComplete) {
          // Buffer the first vision result — injecting with turnComplete:true
          // while the greeting is still speaking would interrupt it
          pendingVisionResult = resultText;
          logger.info({ sessionId }, 'Vision results buffered (waiting for greeting to finish)');
        } else {
          geminiSession.sendClientContent({
            turns: [{
              role: 'user',
              parts: [{ text: resultText }],
            }],
            turnComplete: isFirstVision,
          });
          logger.info({ sessionId }, 'Vision results injected into coordinator');
        }

        sessionLog.push(`[Vision]: ${resultText}`);

        sendToClient(ws, { type: 'vision_active', agents: [] });
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

    // --- PREVIEW GENERATION ---
    const PREVIEW_TRIGGERS = [
      // English
      /let me show you/i,
      /here(?:'?s| is) a preview/i,
      /here(?:'?s| is) (?:a|an|the) (?:quick )?preview/i,
      /let me generate/i,
      /take a look at this/i,
      /how about something like this/i,
      /picture this/i,
      /imagine this look/i,
      // German
      /lass mich dir zeigen/i,
      /ich zeig dir/i,
      /hier ist eine vorschau/i,
      /schau dir das an/i,
      /stell dir vor/i,
      /wie w[äa]re es mit/i,
      /so k[öo]nnte das aussehen/i,
    ];

    async function handlePreviewGeneration(
      bodyCrop: string,
      prompt: string,
      category?: string,
      trigger: 'agent' | 'client' = 'client',
    ) {
      if (previewInProgress) {
        // The agent narrated a second trigger phrase before the first preview
        // finished — drop it silently. Surfacing this would confuse the user
        // since they didn't ask for anything.
        logger.info({ sessionId, trigger }, 'Preview generation already in progress');
        return;
      }

      previewInProgress = true;
      sendToClient(ws, { type: 'preview_generating', prompt });

      try {
        const result = await Promise.race([
          generateStylePreview({
            sourceImage: bodyCrop,
            prompt,
            category: category as GenerationRequest['category'],
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('preview_timeout')), PREVIEW_TIMEOUT_MS),
          ),
        ]);

        sendToClient(ws, {
          type: 'preview_image',
          url: result.url,
          ...(result.image && { image: result.image }),
          mimeType: result.mimeType,
          prompt,
          description: result.description,
          trigger,
        });

        sessionLog.push(`[Preview generated]: ${prompt}`);

        // Persist a row so followers (and the owner's history) can see the
        // image until expires_at (now + 24h). Fire-and-forget — don't block
        // the user's in-session preview UX on the database write.
        dbService
          .saveSessionImage({
            sessionId,
            deviceId,
            storageUrl: result.url,
            mimeType: result.mimeType,
            prompt,
            ...(result.description && { description: result.description }),
          })
          .catch((err) => logger.warn({ sessionId, err }, 'Failed to persist session_image row'));

        geminiSession.sendClientContent({
          turns: [{
            role: 'user',
            parts: [{
              text: `[System: A style preview image was just generated and shown to the user. Prompt: "${prompt}". The user can see it on their screen. Do NOT use phrases like "let me show you" or "here's a preview" again — the preview is already visible. Just continue the conversation naturally.]`,
            }],
          }],
          turnComplete: false,
        });
      } catch (error: any) {
        const isTimeout = error?.message === 'preview_timeout';
        logger.error(
          { sessionId, error: error?.message, timeout: isTimeout },
          'Preview generation failed',
        );
        sendToClient(ws, {
          type: 'preview_error',
          message: isTimeout
            ? 'Preview is taking too long. Please try again.'
            : 'Could not generate preview. Please try again.',
          prompt,
        });
      } finally {
        // Short cooldown so the agent's immediate follow-up sentence
        // (e.g. "as you can see in the preview…") doesn't accidentally
        // re-trigger. Kept short so a genuine *new* preview request a
        // few seconds later isn't silently dropped. The system message
        // injected on success also tells the agent to stop using the
        // trigger phrases.
        previewCooldownUntil = Date.now() + 5000;
        transcriptBuffer = '';
        if (previewResetTimer) clearTimeout(previewResetTimer);
        previewResetTimer = setTimeout(() => {
          previewInProgress = false;
          previewResetTimer = null;
        }, 5000);
      }
    }

    function checkForPreviewTrigger(text: string) {
      // Skip trigger detection during cooldown (prevents loop from agent referencing the preview)
      if (Date.now() < previewCooldownUntil) return;

      transcriptBuffer += text;

      logger.info(
        { sessionId, fragment: text, bufferLen: transcriptBuffer.length, bufferPreview: transcriptBuffer.slice(-120) },
        'Preview trigger: received output text',
      );

      // Split buffer into complete sentences (ending with . ! ?) and keep remainder
      const sentencePattern = /[^.!?]*[.!?]+/g;
      const sentences: string[] = [];
      let lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = sentencePattern.exec(transcriptBuffer)) !== null) {
        sentences.push(match[0]);
        lastIndex = sentencePattern.lastIndex;
      }

      if (sentences.length === 0) return;

      // Keep any trailing text without punctuation in the buffer
      transcriptBuffer = transcriptBuffer.slice(lastIndex);

      // Check each complete sentence for trigger phrases
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;

        logger.info(
          { sessionId, sentence: trimmed },
          'Preview trigger: checking sentence',
        );

        const triggered = PREVIEW_TRIGGERS.some((pattern) => pattern.test(trimmed));
        if (!triggered) continue;

        if (!latestBodyCrop) {
          logger.warn({ sessionId }, 'Preview trigger matched but no body crop available');
          continue;
        }

        const styleDescription = extractStyleDescription(trimmed);
        if (!styleDescription) {
          logger.warn({ sessionId, sentence: trimmed }, 'Preview trigger matched but could not extract style description');
          continue;
        }

        logger.info(
          { sessionId, trigger: trimmed, extracted: styleDescription },
          'Agent triggered preview generation',
        );

        handlePreviewGeneration(latestBodyCrop, styleDescription, undefined, 'agent');
        return; // Only trigger once per batch
      }
    }

    // Called when the agent finishes speaking — check any remaining buffer
    function checkBufferOnTurnComplete() {
      // Flush buffered vision results once greeting finishes
      if (!greetingComplete) {
        greetingComplete = true;
        if (pendingVisionResult) {
          logger.info({ sessionId }, 'Greeting done — injecting buffered vision results');
          geminiSession.sendClientContent({
            turns: [{
              role: 'user',
              parts: [{ text: pendingVisionResult }],
            }],
            turnComplete: true,
          });
          pendingVisionResult = null;
        }
      }

      if (Date.now() < previewCooldownUntil) {
        transcriptBuffer = '';
        return;
      }
      if (!transcriptBuffer.trim()) return;

      const remaining = transcriptBuffer.trim();
      transcriptBuffer = '';

      logger.info(
        { sessionId, sentence: remaining },
        'Preview trigger: checking remaining buffer on turn complete',
      );

      const triggered = PREVIEW_TRIGGERS.some((pattern) => pattern.test(remaining));
      if (!triggered || !latestBodyCrop) return;

      const styleDescription = extractStyleDescription(remaining);
      if (!styleDescription) return;

      logger.info(
        { sessionId, trigger: remaining, extracted: styleDescription },
        'Agent triggered preview generation (turn complete fallback)',
      );

      handlePreviewGeneration(latestBodyCrop, styleDescription, undefined, 'agent');
    }

    function extractStyleDescription(sentence: string): string | null {
      let description = sentence;
      for (const trigger of PREVIEW_TRIGGERS) {
        description = description.replace(trigger, '');
      }

      // Strip leading punctuation/whitespace, then any leading filler words
      // ("of", "with", "showing", "a"/"an"/"the") so the prompt reads cleanly.
      description = description
        .replace(/^[\s,.:—-]+/, '')
        .replace(/^(?:of|with|showing|featuring|that has|that shows)\s+/i, '')
        .replace(/^(?:a |an |the )/i, '')
        .replace(/[.!?]+$/, '')
        .trim();

      if (description.length < 5) return null;

      return `Apply this style change to the person in the photo: ${description}. Keep the person's face and identity clearly recognizable. Make the change look natural and realistic.`;
    }

    // --- PRODUCT RECOMMENDATIONS ---
    async function checkForProductTrigger(text: string) {
      const result = productTrigger.checkTranscript(text);
      if (!result) return;

      try {
        const products = await searchProducts(result.query, sessionRegion, 6);
        if (products.length === 0) return;

        shownProducts.push(...products);
        sendToClient(ws, { type: 'products', products });
        logger.info({ sessionId, query: result.query, count: products.length }, 'Sent product recommendations');
      } catch (error: any) {
        logger.warn({ sessionId, error: error.message }, 'Product search failed during session');
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

      // Generate and save session summary (fire-and-forget)
      if (sessionLog.length > 0) {
        const durationSeconds = Math.round((Date.now() - sessionStartedAt) / 1000);
        generateSessionSummary(sessionLog, sessionId, deviceId, genai, durationSeconds, sessionOccasion, userLanguage, shownProducts).catch(err => {
          logger.warn({ sessionId, error: err }, 'Failed to generate session summary');
        });
      }
    }
  });
}

/**
 * Process a Gemini Live server message and forward relevant data to the client.
 */
function processGeminiMessage(msg: LiveServerMessage, ws: WebSocket, sessionId: string, sessionLog: string[], onOutputText?: (text: string) => void, onTurnComplete?: () => void, onProductCheck?: (text: string) => void, onSpeakingChange?: (speaking: boolean) => void): void {
  // Handle server content (audio, text, transcriptions)
  if (msg.serverContent) {
    const content = msg.serverContent;

    // Model turn — audio and text parts
    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
          onSpeakingChange?.(true);
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
      sessionLog.push(`[User]: ${content.inputTranscription.text}`);
    }

    // Output transcription
    if (content.outputTranscription?.text) {
      sendToClient(ws, {
        type: 'transcript',
        direction: 'output',
        text: content.outputTranscription.text,
        finished: false,
      });
      sessionLog.push(`[Stylist]: ${content.outputTranscription.text}`);
      onOutputText?.(content.outputTranscription.text);
      onProductCheck?.(content.outputTranscription.text);
    }

    // Turn complete
    if (content.turnComplete) {
      onSpeakingChange?.(false);
      sendToClient(ws, { type: 'state', ai_state: 'listening' });
      sendToClient(ws, {
        type: 'transcript',
        direction: 'output',
        text: '',
        finished: true,
      });
      onTurnComplete?.();
    }

    // Interrupted
    if (content.interrupted) {
      onSpeakingChange?.(false);
      sendToClient(ws, { type: 'state', ai_state: 'listening' });
    }
  }

  // Setup complete
  if (msg.setupComplete) {
    logger.info({ sessionId }, 'Gemini Live setup complete');
  }
}

/**
 * Generate a summary of the session and save it to Firestore.
 */
async function generateSessionSummary(
  sessionLog: string[],
  sessionId: string,
  deviceId: string,
  genai: GoogleGenAI,
  durationSeconds?: number,
  occasion?: import('../types/index.js').Occasion,
  language?: string,
  shownProducts?: ProductResult[],
): Promise<void> {
  try {
    const transcript = sessionLog.join('\n');
    const langInstruction = language && language !== 'en'
      ? `\n\nIMPORTANT: Write the summary and tips in the SAME LANGUAGE as the session transcript. The session was conducted in a non-English language — your output MUST be in that same language.`
      : '';
    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        role: 'user',
        parts: [{
          text: `Analyze this beauty/style consultation session and return a JSON object with exactly this format:
{
  "summary": "...",
  "tips": ["tip 1", "tip 2", "tip 3"]
}

For the summary: Include ONLY new information from THIS session — do NOT repeat or rephrase anything the stylist recalled from previous sessions. Focus on: what the user was wearing, new observations about their appearance, new recommendations given, and any new preferences or requests the user expressed. Keep it concise (100-150 words). Write in past tense, third person.

For tips: Extract 2-3 specific, actionable style tips that were discussed or recommended during the session. Each tip should be a short, practical sentence the user can reference later.

Return ONLY the JSON object, no markdown formatting or code blocks.${langInstruction}

Session transcript:
${transcript}`,
        }],
      }],
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      logger.warn({ sessionId }, 'Empty summary generated, skipping save');
      return;
    }

    let summary: string;
    let tips: string[] = [];

    try {
      // Strip markdown code fences if present (e.g. ```json ... ```)
      const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      summary = parsed.summary || rawText;
      tips = Array.isArray(parsed.tips) ? parsed.tips : [];
    } catch {
      // Fallback: use raw text as summary
      summary = rawText;
    }

    await dbService.saveSessionMemory(deviceId, {
      session_id: sessionId,
      summary,
      tips,
      ...(durationSeconds !== undefined && { duration_seconds: durationSeconds }),
      ...(occasion && { occasion }),
      ...(shownProducts && shownProducts.length > 0 && { products: shownProducts }),
      created_at: new Date().toISOString(),
    });

    // Notify accepted followers that there's a new session to peek at.
    try {
      const followerIds = await dbService.getAcceptedFollowersDeviceIds(deviceId);
      if (followerIds.length > 0) {
        const owner = await dbService.getUser(deviceId).catch(() => null);
        const name = owner?.name ?? 'A friend';
        await push.fanoutPush(
          followerIds,
          'new_session',
          `${name} just finished a session`,
          'Tap to see their new style update',
          { session_id: sessionId, followee_device_id: deviceId },
        );
      }
    } catch (pushErr) {
      logger.warn({ sessionId, err: pushErr }, 'Follower notification fan-out failed');
    }
  } catch (error) {
    logger.warn({ sessionId, error }, 'Session summary generation failed');
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
