/**
 * Derive the Android adaptive-icon foreground from the chosen icon.png.
 *
 * Uses Fal's gemini-25-flash-image/edit to strip the background — produces
 * a 1024x1024 PNG with the speech bubble + star centered on transparent.
 *
 * Run: cd backend && npx tsx scripts/derive-icon-assets.ts
 */
import 'dotenv/config';
import { fal } from '@fal-ai/client';
import { readFileSync, writeFileSync } from 'node:fs';

if (!process.env.FAL_AI_KEY) {
  console.error('FAL_AI_KEY not set');
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_AI_KEY });

const INPUT = '/Users/stefangimeson/live_stylist_ai/app/assets/icon.png';
const OUTPUT = '/Users/stefangimeson/live_stylist_ai/app/assets/adaptive-icon.png';

async function main(): Promise<void> {
  const inputBase64 = readFileSync(INPUT).toString('base64');
  console.log('Editing icon to remove background…');

  const result = await fal.subscribe('fal-ai/gemini-25-flash-image/edit', {
    input: {
      prompt:
        'Remove the entire background and the rounded-square frame completely. Keep ONLY the speech bubble and the star shape. Make the background fully transparent. Center the shapes in the canvas with about 15% padding on each side so they fit inside an Android adaptive-icon safe area. Maintain the original colors and gradients of the speech bubble and star.',
      image_urls: [`data:image/png;base64,${inputBase64}`],
    },
    logs: false,
  });

  const data = result.data as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('No image returned');
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(OUTPUT, buf);
  console.log(`Wrote ${OUTPUT} (${(buf.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
