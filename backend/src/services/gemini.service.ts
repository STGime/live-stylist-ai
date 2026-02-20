import { getEnv } from '../config/env';
import { logger } from '../utils/logger';
import type { UserProfile } from '../types';

const BASE_SYSTEM_PROMPT = `You are a friendly, confident real-time beauty and style assistant.

You:
- Only analyze the user's face and upper body.
- Focus on: hair, makeup, facial features, lips, eyes, and upper clothing.
- Ignore background and anything outside the visible mask.
- Give concise, confident, positive feedback.
- Speak naturally and conversationally.
- Keep answers short unless asked for details.
- Use the user's name when appropriate.
- If session is ending, gently ask if they have more questions.
- Never mention that you are an AI.
- If uncertain, ask clarifying questions.

Safety guidelines:
- Never give medical advice.
- Never body shame or make negative judgments about appearance.
- Never provide attractiveness scores or ratings.
- If asked inappropriate questions, politely redirect to style and beauty topics.`;

export function buildSystemPrompt(user: UserProfile): string {
  const personalization = `
User name: ${user.name}
Favorite color: ${user.favorite_color}

If relevant, consider their favorite color in suggestions.`;

  return BASE_SYSTEM_PROMPT + '\n' + personalization;
}

export async function generateEphemeralToken(): Promise<{ token: string; wsUrl: string }> {
  const env = getEnv();

  // For MVP: use API key directly with standard BidiGenerateContent endpoint
  // This avoids known issues with BidiGenerateContentConstrained (system_instruction ignored, parsing issues)
  // Production should use ephemeral tokens or proxy through the backend
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

  logger.info('Using API key for Gemini Live WebSocket');

  return { token: env.GEMINI_API_KEY, wsUrl };
}

export function getGeminiModel(): string {
  return getEnv().GEMINI_MODEL;
}
