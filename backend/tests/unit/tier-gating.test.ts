import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be set up before importing the SUT.
const mockState = {
  user: { id: 'u1', device_id: 'd1', trial_used: false } as any,
  monthlySessions: [] as Array<{ id: string }>,
  updateCalls: [] as Array<{ id: string; patch: any }>,
};

vi.mock('../../src/config/env', () => ({
  getEnv: () => ({ MONTHLY_PREMIUM_SESSION_CAP: 30 }),
}));

vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/config/eurobase', () => ({
  getEurobase: () => ({
    db: {
      from(table: string) {
        const builder = {
          _filters: [] as Array<[string, any]>,
          _columns: [] as string[],
          select(...cols: string[]) {
            this._columns = cols;
            return this;
          },
          eq(col: string, val: any) {
            this._filters.push([col, val]);
            return this;
          },
          gte(_col: string, _val: any) {
            return this;
          },
          single() {
            if (table === 'app_users') {
              return Promise.resolve({ data: mockState.user, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
          then(resolve: any) {
            // Awaiting the builder directly = list query.
            if (table === 'sessions') {
              return resolve({ data: mockState.monthlySessions, error: null });
            }
            return resolve({ data: null, error: null });
          },
          update(id: string, patch: any) {
            mockState.updateCalls.push({ id, patch });
            return Promise.resolve({ data: { ...mockState.user, ...patch }, error: null });
          },
        };
        return builder as any;
      },
    },
  }),
}));

import * as dbService from '../../src/services/db.service.js';

describe('tier gating: incrementSessionCount', () => {
  beforeEach(() => {
    mockState.user = { id: 'u1', device_id: 'd1', trial_used: false };
    mockState.monthlySessions = [];
    mockState.updateCalls = [];
  });

  describe('free tier (lifetime trial)', () => {
    it('allows the first session and marks trial_used', async () => {
      const result = await dbService.incrementSessionCount('d1', 'free');
      expect(result.allowed).toBe(true);
      expect(mockState.updateCalls).toEqual([{ id: 'u1', patch: { trial_used: true } }]);
    });

    it('blocks once trial_used is true', async () => {
      mockState.user.trial_used = true;
      const result = await dbService.incrementSessionCount('d1', 'free');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('trial_used');
      expect(mockState.updateCalls).toHaveLength(0);
    });
  });

  describe('premium tier (monthly soft cap)', () => {
    it('allows when under the monthly cap', async () => {
      mockState.monthlySessions = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}` }));
      const result = await dbService.incrementSessionCount('d1', 'premium');
      expect(result.allowed).toBe(true);
      expect(result.sessionsUsedThisMonth).toBe(6);
      expect(result.remaining).toBe(24);
    });

    it('blocks at the monthly cap', async () => {
      mockState.monthlySessions = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}` }));
      const result = await dbService.incrementSessionCount('d1', 'premium');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('monthly_cap');
      expect(result.remaining).toBe(0);
    });

    it('does not consult trial_used for premium users', async () => {
      mockState.user.trial_used = true; // would block as free
      mockState.monthlySessions = [];
      const result = await dbService.incrementSessionCount('d1', 'premium');
      expect(result.allowed).toBe(true);
    });
  });
});
