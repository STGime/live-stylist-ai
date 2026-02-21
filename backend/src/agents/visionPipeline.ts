import { GoogleGenAI } from '@google/genai';
import { eyeAgent } from './eyeAgent';
import { mouthAgent } from './mouthAgent';
import { bodyAgent } from './bodyAgent';
import { getEnv } from '../config/env';
import { logger } from '../utils/logger';

export interface VisionResults {
  eye_analysis: Record<string, unknown>;
  mouth_analysis: Record<string, unknown>;
  body_analysis: Record<string, unknown>;
}

/**
 * Runs 3 vision analyses in parallel using direct Gemini API calls.
 * Each agent receives its specialized prompt + the corresponding image crop.
 * Returns structured JSON results from all 3 agents.
 *
 * Called directly from the WebSocket handler — NOT through ADK tool calling.
 * Results are injected as text into the coordinator's live request queue.
 */
export async function runVisionPipeline(
  eyeCrop: string,
  mouthCrop: string,
  bodyCrop: string,
): Promise<VisionResults> {
  const env = getEnv();
  const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  const [eyeResult, mouthResult, bodyResult] = await Promise.all([
    genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: (eyeAgent.instruction as string) + '\n\nAnalyze this eye region image. Return JSON only.' },
          { inlineData: { mimeType: 'image/jpeg', data: eyeCrop } },
        ],
      }],
      config: { responseMimeType: 'application/json' },
    }),
    genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: (mouthAgent.instruction as string) + '\n\nAnalyze this mouth region image. Return JSON only.' },
          { inlineData: { mimeType: 'image/jpeg', data: mouthCrop } },
        ],
      }],
      config: { responseMimeType: 'application/json' },
    }),
    genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: (bodyAgent.instruction as string) + '\n\nAnalyze this face and upper body image. Return JSON only.' },
          { inlineData: { mimeType: 'image/jpeg', data: bodyCrop } },
        ],
      }],
      config: { responseMimeType: 'application/json' },
    }),
  ]);

  const eye_analysis = JSON.parse(eyeResult.text ?? '{}');
  const mouth_analysis = JSON.parse(mouthResult.text ?? '{}');
  const body_analysis = JSON.parse(bodyResult.text ?? '{}');

  logger.info('Vision pipeline completed all 3 analyses');

  return { eye_analysis, mouth_analysis, body_analysis };
}

/**
 * Formats vision results into a text string for injection into the
 * coordinator's conversation context.
 */
export function formatVisionResults(results: VisionResults): string {
  return [
    '[Vision update — do not read this aloud, use it to inform your next response]',
    '',
    'Eye analysis:',
    JSON.stringify(results.eye_analysis, null, 2),
    '',
    'Mouth analysis:',
    JSON.stringify(results.mouth_analysis, null, 2),
    '',
    'Face/body analysis:',
    JSON.stringify(results.body_analysis, null, 2),
  ].join('\n');
}
