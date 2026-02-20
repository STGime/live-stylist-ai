import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/env', () => ({
  getEnv: () => ({
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-2.0-flash-exp',
  }),
}));

import { buildSystemPrompt, getGeminiModel } from '../../src/services/gemini.service';
import type { UserProfile } from '../../src/types';

describe('GeminiService', () => {
  describe('buildSystemPrompt', () => {
    it('should include base instructions', () => {
      const user = {
        name: 'Alice',
        favorite_color: 'blue',
      } as UserProfile;

      const prompt = buildSystemPrompt(user);

      expect(prompt).toContain('real-time beauty and style assistant');
      expect(prompt).toContain('Only analyze the user\'s face and upper body');
      expect(prompt).toContain('Never mention that you are an AI');
    });

    it('should include personalization', () => {
      const user = {
        name: 'Bob',
        favorite_color: 'green',
      } as UserProfile;

      const prompt = buildSystemPrompt(user);

      expect(prompt).toContain('User name: Bob');
      expect(prompt).toContain('Favorite color: green');
    });

    it('should include safety guidelines', () => {
      const user = {
        name: 'Test',
        favorite_color: 'red',
      } as UserProfile;

      const prompt = buildSystemPrompt(user);

      expect(prompt).toContain('Never give medical advice');
      expect(prompt).toContain('Never body shame');
      expect(prompt).toContain('attractiveness scores');
    });
  });

  describe('getGeminiModel', () => {
    it('should return configured model', () => {
      expect(getGeminiModel()).toBe('gemini-2.0-flash-exp');
    });
  });
});
