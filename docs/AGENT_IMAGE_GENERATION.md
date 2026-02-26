# Agent-Driven Image Generation for LiveStylist AI

## Overview

This document describes the design for adding image generation capabilities to LiveStylist AI. Currently the agent can see users (via vision pipeline) and talk about style suggestions, but cannot show visual previews. This feature lets the agent generate preview images showing the user with suggested changes — hairstyles, makeup looks, outfit modifications — and send them over the existing WebSocket connection.

**Key decisions:**
- Uses Gemini 2.5 Flash image editing directly via `@google/genai` SDK (no fal.ai intermediary)
- Runs as a separate service alongside the existing vision pipeline
- Results flow over WebSocket as base64 images, not REST URLs
- No credit system — session-based billing via RevenueCat
- Agent-triggered (detects intent from coordinator output) and client-triggered (explicit request)

---

## 1. Image Generation Service

### New file: `backend/src/services/image-generation.service.ts`

This service wraps Gemini 2.5 Flash image editing using the same `@google/genai` SDK pattern from `visionPipeline.ts`. The key difference: instead of requesting JSON analysis, we request image output using `responseModalities: ['IMAGE', 'TEXT']`.

```typescript
import { GoogleGenAI } from '@google/genai';
import { getEnv } from '../config/env';
import { logger } from '../utils/logger';

export interface GenerationRequest {
  /** Base64-encoded source image (JPEG from body_crop) */
  sourceImage: string;
  /** Edit prompt describing the desired transformation */
  prompt: string;
  /** Optional: category hint for prompt template selection */
  category?: 'hairstyle' | 'makeup' | 'accessory' | 'clothing' | 'full_look';
}

export interface GenerationResult {
  /** Base64-encoded result image */
  image: string;
  /** MIME type of the result */
  mimeType: string;
  /** Text description returned by Gemini (if any) */
  description?: string;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Generate a style preview image using Gemini 2.5 Flash image editing.
 *
 * Follows the same direct SDK call pattern as visionPipeline.ts:
 * - Creates GoogleGenAI instance with API key
 * - Calls genai.models.generateContent() with inline image data
 * - Parses response parts for image and text
 *
 * Unlike the vision pipeline (which requests JSON), this uses
 * responseModalities: ['IMAGE', 'TEXT'] to get an edited image back.
 */
export async function generateStylePreview(
  request: GenerationRequest,
): Promise<GenerationResult> {
  const startTime = Date.now();
  const env = getEnv();
  const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  logger.info(
    { promptLength: request.prompt.length, category: request.category },
    'Starting image generation',
  );

  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: request.prompt },
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

  // Parse response — Gemini returns parts with either inlineData (image) or text
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
```

### Why direct Gemini SDK (not fal.ai)?

The fejja-backend filters use fal.ai as a proxy to Gemini (`fal-ai/gemini-25-flash-image/edit`) because they need URL-based image storage for REST responses. LiveStylist AI doesn't need that — images flow as base64 over WebSocket, so calling Gemini directly is simpler, faster (no queue), and cheaper (no fal.ai markup).

---

## 2. WebSocket Integration

### 2a. New Types in `backend/src/types/index.ts`

Add these to the existing `ClientEvent` and `ServerEvent` unions:

```typescript
// --- Client Events (add to ClientEvent union + ClientEventSchema) ---

/** Client explicitly requests a style preview */
| { type: 'generate_preview'; prompt: string; category?: string }

// --- Server Events (add to ServerEvent union) ---

/** Sent when image generation starts */
| { type: 'preview_generating'; prompt: string }

/** Sent when a preview image is ready */
| {
    type: 'preview_image';
    image: string;        // base64-encoded
    mimeType: string;     // e.g. 'image/jpeg'
    prompt: string;       // the prompt used
    description?: string; // Gemini's text description
    trigger: 'agent' | 'client';  // who initiated it
  }

/** Sent if generation fails */
| { type: 'preview_error'; message: string; prompt: string }
```

Update the Zod schema:

```typescript
// Add to ClientEventSchema discriminatedUnion array:
z.object({
  type: z.literal('generate_preview'),
  prompt: z.string().min(1).max(500),
  category: z.enum(['hairstyle', 'makeup', 'accessory', 'clothing', 'full_look']).optional(),
}),
```

### 2b. WebSocket Handler Changes in `backend/src/ws/adk-session.ws.ts`

Extend the existing message handler with three additions:

#### (i) Store the latest body_crop

Add state tracking near the existing `visionInProgress` variable:

```typescript
let latestBodyCrop: string | null = null;
```

In the `case 'frame':` handler, capture the body crop:

```typescript
case 'frame':
  // ... existing logging ...
  if (msg.body_crop) {
    latestBodyCrop = msg.body_crop;
  }
  // ... existing vision pipeline trigger ...
  break;
```

#### (ii) Handle explicit `generate_preview` messages

Add a new case to the message switch:

```typescript
case 'generate_preview':
  if (!latestBodyCrop) {
    sendToClient(ws, {
      type: 'preview_error',
      message: 'No image available yet. Please ensure the camera can see you.',
      prompt: msg.prompt || '',
    });
    break;
  }
  handlePreviewGeneration(
    latestBodyCrop,
    msg.prompt,
    msg.category,
    'client',
  );
  break;
```

#### (iii) Preview generation function

Add alongside the existing `triggerVisionAnalysis` function:

```typescript
let previewInProgress = false;

async function handlePreviewGeneration(
  bodyCrop: string,
  prompt: string,
  category?: string,
  trigger: 'agent' | 'client' = 'client',
) {
  if (previewInProgress) {
    logger.info({ sessionId }, 'Preview generation already in progress, skipping');
    return;
  }

  previewInProgress = true;
  sendToClient(ws, { type: 'preview_generating', prompt });

  try {
    const result = await generateStylePreview({
      sourceImage: bodyCrop,
      prompt,
      category: category as GenerationRequest['category'],
    });

    sendToClient(ws, {
      type: 'preview_image',
      image: result.image,
      mimeType: result.mimeType,
      prompt,
      description: result.description,
      trigger,
    });

    // Log to session for summary
    sessionLog.push(`[Preview generated]: ${prompt}`);

    // Notify the coordinator that a preview was shown
    geminiSession.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{
          text: `[System: A style preview image was just generated and shown to the user. Prompt: "${prompt}". You can reference it naturally, e.g. "As you can see in the preview..." — do not read this aloud.]`,
        }],
      }],
      turnComplete: false,
    });
  } catch (error: any) {
    logger.error({ sessionId, error: error.message }, 'Preview generation failed');
    sendToClient(ws, {
      type: 'preview_error',
      message: 'Could not generate preview. Please try again.',
      prompt,
    });
  } finally {
    // Cooldown — prevent rapid-fire generation (5s)
    setTimeout(() => {
      previewInProgress = false;
    }, 5000);
  }
}
```

---

## 3. Agent-Triggered Generation

The coordinator can trigger image generation by using specific phrases in its output. The WebSocket handler monitors the output transcription for trigger phrases and auto-generates previews.

### 3a. Output Transcription Scanning

In `processGeminiMessage`, extend the output transcription handler:

```typescript
// Output transcription — check for preview triggers
if (content.outputTranscription?.text) {
  // ... existing transcript handling ...

  // Check for agent-triggered preview generation
  checkForPreviewTrigger(content.outputTranscription.text);
}
```

The trigger detection function (inside the connection closure, with access to session state):

```typescript
const PREVIEW_TRIGGERS = [
  /let me show you/i,
  /here'?s a preview/i,
  /let me generate/i,
  /take a look at this/i,
  /how about something like this/i,
  /picture this/i,
  /imagine this look/i,
];

let transcriptBuffer = '';

function checkForPreviewTrigger(text: string) {
  transcriptBuffer += ' ' + text;

  // Only check on sentence boundaries (period, question mark, exclamation)
  if (!/[.!?]/.test(text)) return;

  const sentence = transcriptBuffer.trim();
  transcriptBuffer = '';

  const triggered = PREVIEW_TRIGGERS.some((pattern) => pattern.test(sentence));
  if (!triggered || !latestBodyCrop) return;

  // Extract the style description from the sentence
  // The coordinator is instructed to include the description after the trigger phrase
  const styleDescription = extractStyleDescription(sentence);
  if (!styleDescription) return;

  logger.info(
    { sessionId, trigger: sentence, extracted: styleDescription },
    'Agent triggered preview generation',
  );

  handlePreviewGeneration(latestBodyCrop, styleDescription, undefined, 'agent');
}

function extractStyleDescription(sentence: string): string | null {
  // Remove trigger phrases to isolate the style description
  let description = sentence;
  for (const trigger of PREVIEW_TRIGGERS) {
    description = description.replace(trigger, '');
  }

  // Clean up punctuation and whitespace
  description = description.replace(/^[\s,.:—-]+/, '').replace(/[.!?]+$/, '').trim();

  // Must have meaningful content (at least 10 chars)
  if (description.length < 10) return null;

  // Wrap with an edit instruction prefix for Gemini
  return `Apply this style change to the person in the photo: ${description}. Keep the person's face and identity clearly recognizable. Make the change look natural and realistic.`;
}
```

### 3b. Coordinator Instruction Update

Add a new section to `buildCoordinatorInstruction` in `backend/src/agents/coordinator.ts`:

```typescript
// Add after the SAFETY section in BASE_COORDINATOR_INSTRUCTION:

const PREVIEW_CAPABILITY_INSTRUCTION = `
STYLE PREVIEWS:
- You have the ability to generate preview images showing the user with style changes
- When suggesting a specific look (hairstyle, makeup, accessory, clothing), you can offer to show a preview
- To trigger a preview, use one of these phrases followed by a clear description:
  - "Let me show you [description]"
  - "Here's a preview of [description]"
  - "Picture this — [description]"
- Be SPECIFIC in descriptions. Good: "Let me show you with a soft balayage in warm honey tones"
  Bad: "Let me show you what I mean"
- Don't offer previews for every suggestion — use them for key moments:
  - When the user seems interested but uncertain
  - When describing a dramatic change
  - When comparing two specific options
- After a preview is shown, you can reference it: "As you can see..." or "What do you think of that look?"
- Limit to 2-3 previews per session to keep the experience focused
- If the user asks "can you show me?" — always generate a preview`;
```

---

## 4. Prompt Engineering Patterns

### Design Philosophy

The fejja-backend filter system demonstrates two effective prompt patterns:

1. **Concise scene-setting** (AlterEgosGamer): `"Put a gaming headset with a microphone on this pet. Place them in a dark room lit by glowing RGB computer lights..."` — Direct, action-oriented, with specific visual details.

2. **Detailed feature-by-feature** (SiamStyleBangkokDailyGlam): `"Apply a complete, polished Thai-style makeup transformation. Skin: Create a flawless... Brows: Reshape... Eyes: Apply..."` — Structured breakdown of each element with precise descriptions.

For LiveStylist AI, prompts are **dynamically constructed** from conversation context rather than hardcoded. We provide category-specific templates that the generation service fills in.

### Prompt Templates

```typescript
// backend/src/services/prompt-templates.ts

export interface PromptTemplate {
  /** Base instruction prefix */
  prefix: string;
  /** Identity preservation suffix */
  suffix: string;
  /** Example prompts for this category */
  examples: string[];
}

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  hairstyle: {
    prefix:
      'Change the hairstyle of the person in this photo.',
    suffix:
      'Keep the person\'s face, skin tone, and facial features exactly the same. ' +
      'The new hairstyle should look natural and realistic, as if the person actually has this hair. ' +
      'Maintain the original photo quality, lighting, and background.',
    examples: [
      'Give them a soft layered bob with warm honey highlights, tucked behind one ear.',
      'Add long, loose beachy waves in a dark chocolate brown color.',
      'Style their hair in a sleek high ponytail with face-framing pieces.',
      'Give them a textured pixie cut with platinum blonde color.',
    ],
  },

  makeup: {
    prefix:
      'Apply the following makeup look to the person in this photo.',
    suffix:
      'Keep the person\'s face shape, features, and skin tone recognizable. ' +
      'The makeup should look professionally applied and realistic — not painted on or artificial. ' +
      'Maintain the original photo lighting and background.',
    examples: [
      'Apply a soft glam look: flawless skin, warm brown smoky eye, defined brows, nude pink lips with gloss.',
      'Create a bold evening look: dramatic winged eyeliner, false lashes, sculpted contour, deep berry matte lips.',
      'Apply a natural "no-makeup makeup" look: even skin, soft peach blush, barely-there mascara, tinted lip balm.',
      'Do a Korean glass-skin look: dewy luminous skin, gradient coral lip tint, soft brown eyeliner, straight brows.',
    ],
  },

  accessory: {
    prefix:
      'Add the following accessory to the person in this photo.',
    suffix:
      'Keep the person\'s face, hair, and clothing unchanged. ' +
      'The accessory should look naturally worn, with correct perspective, lighting, and shadows. ' +
      'Maintain the original photo quality.',
    examples: [
      'Add elegant gold hoop earrings and a delicate layered necklace.',
      'Put on trendy oversized square sunglasses with tortoiseshell frames.',
      'Add a silk headband in deep emerald green tied as a bow.',
      'Put on a wide-brim straw sun hat with a ribbon band.',
    ],
  },

  clothing: {
    prefix:
      'Change the clothing/outfit of the person in this photo.',
    suffix:
      'Keep the person\'s face, hair, and body proportions exactly the same. ' +
      'The new clothing should fit naturally and match the photo\'s lighting. ' +
      'Maintain the original background and photo quality.',
    examples: [
      'Dress them in a tailored black blazer over a white silk camisole.',
      'Change their outfit to a flowy floral midi dress in soft pastels.',
      'Put them in a cozy oversized cream cable-knit sweater.',
      'Dress them in a sleek leather jacket with a band tee underneath.',
    ],
  },

  full_look: {
    prefix:
      'Transform the person\'s complete style in this photo.',
    suffix:
      'Keep the person\'s facial features and identity clearly recognizable. ' +
      'All changes should look cohesive and natural together. ' +
      'Maintain realistic photo quality.',
    examples: [
      'Give them a complete boho-chic transformation: loose wavy hair with braided crown, earthy eyeshadow, flowy white maxi dress, layered gold jewelry.',
      'Transform into a sleek corporate look: polished blowout, subtle makeup with defined brows and nude lip, tailored navy blazer, pearl studs.',
    ],
  },
};

/**
 * Build a complete edit prompt from a style description and optional category.
 *
 * If a category is provided, uses the corresponding template's prefix/suffix
 * to frame the description. Otherwise, wraps with a generic instruction.
 */
export function buildEditPrompt(
  description: string,
  category?: keyof typeof PROMPT_TEMPLATES,
): string {
  if (category && PROMPT_TEMPLATES[category]) {
    const template = PROMPT_TEMPLATES[category];
    return `${template.prefix} ${description}. ${template.suffix}`;
  }

  // Generic fallback
  return (
    `Apply this style change to the person in the photo: ${description}. ` +
    `Keep the person's face and identity clearly recognizable. ` +
    `Make the change look natural and realistic. Maintain photo quality.`
  );
}
```

### Integration with Generation Service

Update `generateStylePreview` to use templates:

```typescript
import { buildEditPrompt } from './prompt-templates';

export async function generateStylePreview(
  request: GenerationRequest,
): Promise<GenerationResult> {
  // Build the full prompt using templates
  const fullPrompt = request.category
    ? buildEditPrompt(request.prompt, request.category)
    : request.prompt;

  // ... rest of generation logic using fullPrompt ...
}
```

---

## 5. Client Integration (React Native)

### 5a. WebSocket Message Handler

Extend the existing WebSocket message handler in the React Native app:

```typescript
// In the WebSocket onMessage handler (alongside existing audio/transcript handling)

case 'preview_generating':
  // Show a loading indicator in the conversation stream
  dispatch({
    type: 'ADD_PREVIEW_PLACEHOLDER',
    payload: { prompt: message.prompt },
  });
  break;

case 'preview_image':
  // Replace the placeholder with the actual image
  dispatch({
    type: 'SET_PREVIEW_IMAGE',
    payload: {
      image: message.image,
      mimeType: message.mimeType,
      prompt: message.prompt,
      description: message.description,
      trigger: message.trigger,
    },
  });
  break;

case 'preview_error':
  // Remove the placeholder and optionally show an error
  dispatch({
    type: 'REMOVE_PREVIEW_PLACEHOLDER',
    payload: { prompt: message.prompt },
  });
  break;
```

### 5b. Preview Card Component

Display previews inline in the conversation stream as cards:

```typescript
// components/PreviewCard.tsx — conceptual structure

interface PreviewCardProps {
  image: string;       // base64
  mimeType: string;
  prompt: string;
  description?: string;
  trigger: 'agent' | 'client';
}

// The card should:
// 1. Show the generated image at a reasonable size (e.g. 80% width, 4:5 aspect ratio)
// 2. Display a short caption from the prompt or description
// 3. Include a "Save" button to save to camera roll
// 4. Include a "Try another" button that sends a generate_preview message with the same prompt
// 5. Animate in with a fade/scale transition
// 6. Show a shimmer/skeleton loading state while preview_generating
```

### 5c. Explicit Generation Request

Users can also trigger generation via a "Show me" button or by typing/speaking a request:

```typescript
// Send explicit preview request
function requestPreview(prompt: string, category?: string) {
  ws.send(JSON.stringify({
    type: 'generate_preview',
    prompt,
    category,
  }));
}
```

---

## 6. Architecture Diagram

```
┌─────────────────┐         WebSocket          ┌──────────────────────┐
│  React Native    │◄──────────────────────────►│  adk-session.ws.ts   │
│  Client          │                            │                      │
│                  │  frame (body_crop)  ──────►│  latestBodyCrop      │
│                  │  generate_preview   ──────►│                      │
│                  │                            │  ┌──────────────────┐│
│                  │  preview_generating ◄──────│  │ handlePreview    ││
│                  │  preview_image      ◄──────│  │ Generation()     ││
│                  │                            │  └────────┬─────────┘│
│  ┌────────────┐  │                            │           │          │
│  │PreviewCard │  │                            │           ▼          │
│  └────────────┘  │                            │  ┌──────────────────┐│
│                  │                            │  │ image-generation ││
│                  │                            │  │ .service.ts      ││
│                  │                            │  └────────┬─────────┘│
│                  │                            │           │          │
│                  │                            │           ▼          │
│                  │                            │  ┌──────────────────┐│
│                  │                            │  │ Gemini 2.5 Flash ││
│                  │                            │  │ (image editing)  ││
│                  │                            │  └──────────────────┘│
│                  │                            │                      │
│                  │  outputTranscription ◄─────│  Gemini Live API     │
│                  │                            │  (coordinator)       │
│                  │                            │       │              │
│                  │                            │  checkForPreview     │
│                  │                            │  Trigger() ─────────►│
└─────────────────┘                            └──────────────────────┘
```

### Data Flow

1. **Client sends `frame`** → `body_crop` stored as `latestBodyCrop`
2. **Trigger** — either:
   - Client sends `generate_preview` message (explicit)
   - Coordinator says "let me show you..." (agent-triggered, detected via output transcription)
3. **`handlePreviewGeneration()`** called with `latestBodyCrop` + prompt
4. **`preview_generating`** sent to client (show loading state)
5. **`generateStylePreview()`** calls Gemini 2.5 Flash with image + prompt
6. **`preview_image`** sent to client with base64 result
7. **Coordinator notified** via `sendClientContent` that preview was shown
8. Coordinator can naturally reference the preview in conversation

---

## 7. Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| No `body_crop` available yet | Return `preview_error` with message to ensure camera visibility |
| Gemini returns no image | Retry once; if still fails, send `preview_error` |
| Generation takes > 15s | Client shows timeout state; server still completes |
| Rapid-fire requests | 5s cooldown via `previewInProgress` flag |
| WebSocket closes during generation | `sendToClient` silently no-ops (checks `readyState`) |
| Gemini content policy rejection | Catch error, send `preview_error` with generic message |
| Agent triggers preview but no crops | Skip silently (log warning) |

---

## 8. Performance Considerations

- **Gemini image generation latency**: ~3-8 seconds typical. The `preview_generating` event lets the client show a loading state immediately.
- **Base64 payload size**: A 512x512 JPEG at quality 80 is ~50-100KB base64. Acceptable for WebSocket.
- **Concurrency**: One preview at a time per session (via `previewInProgress` flag). Vision pipeline and preview generation can run concurrently since they use separate Gemini API calls.
- **Memory**: `latestBodyCrop` holds one base64 string (~100KB). Replaced on each frame, not accumulated.

---

## 9. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `backend/src/services/image-generation.service.ts` | Gemini image editing wrapper |
| `backend/src/services/prompt-templates.ts` | Category-specific prompt templates |

### Modified Files
| File | Changes |
|------|---------|
| `backend/src/types/index.ts` | Add `generate_preview`, `preview_image`, `preview_generating`, `preview_error` types |
| `backend/src/ws/adk-session.ws.ts` | Store `latestBodyCrop`, handle `generate_preview`, add `handlePreviewGeneration`, add `checkForPreviewTrigger` |
| `backend/src/agents/coordinator.ts` | Add `PREVIEW_CAPABILITY_INSTRUCTION` to system prompt |

### No Changes Needed
| File | Reason |
|------|--------|
| `backend/src/agents/visionPipeline.ts` | Vision pipeline remains independent |
| `backend/src/services/session-manager.service.ts` | No session model changes needed |
| `backend/src/services/firebase.service.ts` | Preview events are session-scoped, not persisted |

---

## 10. Future Enhancements

- **Side-by-side comparison**: Send both original `body_crop` and generated image for a before/after view
- **Multiple variations**: Generate 2-3 variations and let the user pick their favorite
- **Style history**: Persist favorite generated previews to Firestore for the user's style portfolio
- **Conversation-aware prompts**: Use the full vision analysis (eye/mouth/body results) to build more precise prompts that account for current appearance
- **Quality tiers**: Use `gemini-2.5-flash` for quick previews, `gemini-2.5-pro` for high-quality saves
