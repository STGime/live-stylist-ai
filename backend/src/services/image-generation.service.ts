import { GoogleGenAI } from '@google/genai';
import { getEnv } from '../config/env';
import { logger } from '../utils/logger';
import { buildEditPrompt, PROMPT_TEMPLATES } from './prompt-templates';

export interface GenerationRequest {
  sourceImage: string;
  prompt: string;
  category?: 'hairstyle' | 'makeup' | 'accessory' | 'clothing' | 'full_look';
}

export interface GenerationResult {
  image: string;
  mimeType: string;
  description?: string;
  processingTimeMs: number;
}

export async function generateStylePreview(
  request: GenerationRequest,
): Promise<GenerationResult> {
  const startTime = Date.now();
  const env = getEnv();
  const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  const fullPrompt = request.category
    ? buildEditPrompt(request.prompt, request.category as keyof typeof PROMPT_TEMPLATES)
    : request.prompt;

  logger.info(
    { promptLength: fullPrompt.length, category: request.category },
    'Starting image generation',
  );

  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [
      {
        role: 'user',
        parts: [
          { text: fullPrompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: request.sourceImage,
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  });

  let image: string | undefined;
  let mimeType = 'image/jpeg';
  let description: string | undefined;

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        image = part.inlineData.data;
        mimeType = part.inlineData.mimeType || 'image/jpeg';
      }
      if (part.text) {
        description = part.text;
      }
    }
  }

  if (!image) {
    throw new Error('No image returned from Gemini image generation');
  }

  const processingTimeMs = Date.now() - startTime;
  logger.info(
    { processingTimeMs, hasDescription: !!description },
    'Image generation completed',
  );

  return { image, mimeType, description, processingTimeMs };
}
