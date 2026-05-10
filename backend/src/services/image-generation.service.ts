import { fal } from '@fal-ai/client';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { buildEditPrompt, PROMPT_TEMPLATES } from './prompt-templates.js';

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

const FAL_MODEL = 'fal-ai/gemini-25-flash-image/edit';

let _falConfigured = false;
function ensureFalConfigured(): void {
  if (_falConfigured) return;
  const env = getEnv();
  fal.config({ credentials: env.FAL_AI_KEY });
  _falConfigured = true;
}

interface FalEditOutput {
  images?: Array<{ url: string; content_type?: string }>;
  description?: string;
}

export async function generateStylePreview(
  request: GenerationRequest,
): Promise<GenerationResult> {
  const startTime = Date.now();
  ensureFalConfigured();

  const fullPrompt = request.category
    ? buildEditPrompt(request.prompt, request.category as keyof typeof PROMPT_TEMPLATES)
    : request.prompt;

  logger.info(
    { promptLength: fullPrompt.length, category: request.category, model: FAL_MODEL },
    'Starting image generation (Fal.ai)',
  );

  const result = await fal.subscribe(FAL_MODEL, {
    input: {
      prompt: fullPrompt,
      image_urls: [`data:image/jpeg;base64,${request.sourceImage}`],
    },
    logs: false,
  });

  const data = result.data as FalEditOutput;
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error('No image returned from Fal.ai image generation');
  }

  // Fetch the hosted image and convert to base64 to keep the existing
  // wire format with the React Native client unchanged.
  const fetched = await fetch(imageUrl);
  if (!fetched.ok) {
    throw new Error(`Failed to fetch generated image: ${fetched.status} ${fetched.statusText}`);
  }
  const mimeType = data.images?.[0]?.content_type || fetched.headers.get('content-type') || 'image/jpeg';
  const buf = Buffer.from(await fetched.arrayBuffer());
  const image = buf.toString('base64');

  const processingTimeMs = Date.now() - startTime;
  logger.info(
    { processingTimeMs, hasDescription: !!data.description, sizeBytes: buf.byteLength },
    'Image generation completed',
  );

  return { image, mimeType, description: data.description, processingTimeMs };
}
