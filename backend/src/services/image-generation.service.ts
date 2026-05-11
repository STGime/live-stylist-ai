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
  /** Hosted CDN URL from Fal — always present. */
  url: string;
  mimeType: string;
  /** Inline base64 of the image, only populated when PREVIEW_DELIVERY=base64. */
  image?: string;
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
  const env = getEnv();

  const fullPrompt = request.category
    ? buildEditPrompt(request.prompt, request.category as keyof typeof PROMPT_TEMPLATES)
    : request.prompt;

  logger.info(
    { promptLength: fullPrompt.length, category: request.category, model: FAL_MODEL, delivery: env.PREVIEW_DELIVERY },
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
  const mimeType = data.images?.[0]?.content_type || 'image/jpeg';

  // Fast path: hand the CDN URL to the client and let it stream from Fal in
  // parallel with the WebSocket message arriving. Skips a server-side round
  // trip + base64 inflation entirely.
  if (env.PREVIEW_DELIVERY === 'url') {
    const processingTimeMs = Date.now() - startTime;
    logger.info(
      { processingTimeMs, hasDescription: !!data.description, delivery: 'url' },
      'Image generation completed',
    );
    return { url: imageUrl, mimeType, description: data.description, processingTimeMs };
  }

  // Legacy path: fetch the image server-side and inline it as base64.
  const fetched = await fetch(imageUrl);
  if (!fetched.ok) {
    throw new Error(`Failed to fetch generated image: ${fetched.status} ${fetched.statusText}`);
  }
  const resolvedMime = fetched.headers.get('content-type') || mimeType;
  const buf = Buffer.from(await fetched.arrayBuffer());
  const image = buf.toString('base64');

  const processingTimeMs = Date.now() - startTime;
  logger.info(
    { processingTimeMs, hasDescription: !!data.description, sizeBytes: buf.byteLength, delivery: 'base64' },
    'Image generation completed',
  );

  return { url: imageUrl, image, mimeType: resolvedMime, description: data.description, processingTimeMs };
}
