import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../../src/config/env', () => ({
  getEnv: () => ({
    SESSION_DURATION_SECONDS: 300,
    SESSION_WARNING_SECONDS: 270,
  }),
}));

vi.mock('../../src/services/firebase.service', () => ({
  completeSessionRecord: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import * as sessionManager from '../../src/services/session-manager.service';

describe('SessionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await sessionManager.shutdownAllSessions();
    vi.useRealTimers();
  });

  it('should start a session and return session data', () => {
    const session = sessionManager.startSession('device-1', 'free');

    expect(session.session_id).toBeDefined();
    expect(session.device_id).toBe('device-1');
    expect(session.subscription_tier).toBe('free');
    expect(session.expires_at).toBeGreaterThan(session.started_at);
  });

  it('should return existing session for same device (idempotent)', () => {
    const session1 = sessionManager.startSession('device-2', 'free');
    const session2 = sessionManager.startSession('device-2', 'free');

    expect(session1.session_id).toBe(session2.session_id);
  });

  it('should allow different devices to have sessions', () => {
    const session1 = sessionManager.startSession('device-3', 'free');
    const session2 = sessionManager.startSession('device-4', 'premium');

    expect(session1.session_id).not.toBe(session2.session_id);
    expect(sessionManager.getActiveSessionCount()).toBe(2);
  });

  it('should end a session and return duration', async () => {
    const session = sessionManager.startSession('device-5', 'free');

    // Advance time by 60 seconds
    vi.advanceTimersByTime(60_000);

    const result = await sessionManager.endSession(session.session_id, 'manual');

    expect(result).not.toBeNull();
    expect(result!.duration_seconds).toBe(60);
    expect(sessionManager.getActiveSession(session.session_id)).toBeUndefined();
  });

  it('should return null when ending non-existent session', async () => {
    const result = await sessionManager.endSession('nonexistent-id', 'manual');
    expect(result).toBeNull();
  });

  it('should track active session count', () => {
    expect(sessionManager.getActiveSessionCount()).toBe(0);

    sessionManager.startSession('device-6', 'free');
    expect(sessionManager.getActiveSessionCount()).toBe(1);

    sessionManager.startSession('device-7', 'premium');
    expect(sessionManager.getActiveSessionCount()).toBe(2);
  });

  it('should get session by device ID', () => {
    const session = sessionManager.startSession('device-8', 'free');
    const found = sessionManager.getSessionByDevice('device-8');

    expect(found).toBeDefined();
    expect(found!.session_id).toBe(session.session_id);
  });

  it('should shutdown all sessions', async () => {
    sessionManager.startSession('device-9', 'free');
    sessionManager.startSession('device-10', 'premium');

    expect(sessionManager.getActiveSessionCount()).toBe(2);

    await sessionManager.shutdownAllSessions();

    expect(sessionManager.getActiveSessionCount()).toBe(0);
  });
});
