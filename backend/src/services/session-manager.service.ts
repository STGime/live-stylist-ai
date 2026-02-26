import { v4 as uuidv4 } from 'uuid';
import type { WebSocket } from 'ws';
import { getEnv } from '../config/env';
import { logger } from '../utils/logger';
import * as firebaseService from './firebase.service';
import type { ActiveSession, Occasion, ServerEvent, SubscriptionTier } from '../types';

const activeSessions = new Map<string, ActiveSession>();
// deviceId → sessionId mapping to prevent duplicate sessions
const deviceSessions = new Map<string, string>();

const SESSION_ENDING_INJECT = 'The session will end in 30 seconds. Please gently ask the user if they have any final questions.';

function sendWsEvent(session: ActiveSession, event: ServerEvent): void {
  if (session.ws && session.ws.readyState === 1) { // WebSocket.OPEN
    session.ws.send(JSON.stringify(event));
  }
}

export function getActiveSession(sessionId: string): ActiveSession | undefined {
  return activeSessions.get(sessionId);
}

export function getSessionByDevice(deviceId: string): ActiveSession | undefined {
  const sessionId = deviceSessions.get(deviceId);
  if (!sessionId) return undefined;
  return activeSessions.get(sessionId);
}

export function startSession(deviceId: string, tier: SubscriptionTier, occasion?: Occasion): ActiveSession {
  const env = getEnv();

  // Idempotent: return existing active session for this device
  const existing = getSessionByDevice(deviceId);
  if (existing) {
    logger.info({ deviceId, sessionId: existing.session_id }, 'Returning existing active session');
    return existing;
  }

  const sessionId = uuidv4();
  const now = Date.now();
  const expiresAt = now + env.SESSION_DURATION_SECONDS * 1000;

  const session: ActiveSession = {
    session_id: sessionId,
    device_id: deviceId,
    subscription_tier: tier,
    started_at: now,
    expires_at: expiresAt,
    ...(occasion && { occasion }),
  };

  // Warning timer (e.g. 4:30)
  const warningDelay = env.SESSION_WARNING_SECONDS * 1000;
  session.warning_timer = setTimeout(() => {
    const secondsRemaining = env.SESSION_DURATION_SECONDS - env.SESSION_WARNING_SECONDS;
    logger.info({ sessionId, deviceId }, 'Session ending soon');
    sendWsEvent(session, {
      type: 'session_ending_soon',
      session_id: sessionId,
      gemini_inject: SESSION_ENDING_INJECT,
      seconds_remaining: secondsRemaining,
    });
  }, warningDelay);

  // Expiry timer (e.g. 5:00)
  const expiryDelay = env.SESSION_DURATION_SECONDS * 1000;
  session.expiry_timer = setTimeout(() => {
    logger.info({ sessionId, deviceId }, 'Session expired');
    sendWsEvent(session, { type: 'session_expired', session_id: sessionId });
    endSession(sessionId, 'expired').catch(err => {
      logger.error({ sessionId, error: err }, 'Error ending expired session');
    });
  }, expiryDelay);

  activeSessions.set(sessionId, session);
  deviceSessions.set(deviceId, sessionId);

  logger.info({ sessionId, deviceId, tier, expiresAt }, 'Session started');
  return session;
}

export async function endSession(sessionId: string, reason: string = 'manual'): Promise<{ duration_seconds: number } | null> {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  // Clear timers
  if (session.warning_timer) clearTimeout(session.warning_timer);
  if (session.expiry_timer) clearTimeout(session.expiry_timer);

  const durationMs = Date.now() - session.started_at;
  const durationSeconds = Math.round(durationMs / 1000);

  // Send ended event before cleanup
  sendWsEvent(session, {
    type: 'session_ended',
    session_id: sessionId,
    duration_seconds: durationSeconds,
    reason,
  });

  // Close WebSocket if open
  if (session.ws && session.ws.readyState === 1) {
    session.ws.close(1000, 'Session ended');
  }

  // Update Firestore
  try {
    const status = reason === 'expired' ? 'expired' as const : 'completed' as const;
    await firebaseService.completeSessionRecord(sessionId, durationSeconds, status);
  } catch (error) {
    logger.error({ sessionId, error }, 'Failed to update session record in Firestore');
  }

  // Cleanup
  activeSessions.delete(sessionId);
  deviceSessions.delete(session.device_id);

  logger.info({ sessionId, durationSeconds, reason }, 'Session ended');
  return { duration_seconds: durationSeconds };
}

export function attachWebSocket(sessionId: string, ws: WebSocket): boolean {
  const session = activeSessions.get(sessionId);
  if (!session) return false;

  session.ws = ws;

  sendWsEvent(session, {
    type: 'session_started',
    session_id: sessionId,
    expires_at: session.expires_at,
  });

  return true;
}

export function getActiveSessionCount(): number {
  return activeSessions.size;
}

export async function shutdownAllSessions(): Promise<void> {
  logger.info({ count: activeSessions.size }, 'Shutting down all active sessions');
  const promises = Array.from(activeSessions.keys()).map(id => endSession(id, 'server_shutdown'));
  await Promise.allSettled(promises);
}
