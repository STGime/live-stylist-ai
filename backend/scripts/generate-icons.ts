/**
 * Generate a set of app-icon candidates via Fal.ai (Recraft v3 — purpose-built
 * for logos/icons). Saves PNGs into /tmp/livestylist-icons/ for review.
 *
 * Run: cd backend && npx tsx scripts/generate-icons.ts
 */
import 'dotenv/config';
import { fal } from '@fal-ai/client';
import { writeFileSync, mkdirSync } from 'node:fs';

if (!process.env.FAL_AI_KEY) {
  console.error('FAL_AI_KEY not set');
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_AI_KEY });

const OUT_DIR = '/tmp/livestylist-icons';
mkdirSync(OUT_DIR, { recursive: true });

const COMMON =
  'Centered subject, no text, no letters, no words, perfectly square composition, flat geometric design, vibrant warm gradient, suitable as a 1024x1024 mobile app icon. Pink, magenta, lavender, and soft gold palette. High contrast against background. Recognizable at very small sizes.';

const CANDIDATES = [
  {
    name: 'speechbubble-sparkle',
    prompt: `Modern app icon: a rounded speech-bubble shape combined with a sparkle / 4-pointed star inside it, set on a soft pink-to-lavender gradient background. The speech bubble represents live conversation, the sparkle represents AI magic and styling. Minimalist, friendly, feminine but inclusive. ${COMMON}`,
  },
  {
    name: 'mirror-sparkle',
    prompt: `Modern app icon: a stylized hand mirror with a sparkle / 4-pointed star reflected on its surface, on a warm pink-magenta gradient. The mirror suggests style and self-presentation, the sparkle suggests AI assistance. Clean flat geometric design, no realism, iconic and bold. ${COMMON}`,
  },
  {
    name: 'face-silhouette',
    prompt: `Modern app icon: simple geometric face silhouette in profile view, lavender/magenta gradient, with a small sparkle / 4-pointed star next to the face suggesting AI styling. Minimalist, elegant, feminine but not exclusive. ${COMMON}`,
  },
  {
    name: 'wand-sparkle',
    prompt: `Modern app icon: a stylized magic wand emitting a constellation of small sparkles, on a soft pink to gold gradient. The wand represents personal styling, the sparkles represent the AI's many small suggestions. Flat clean geometric design, no realism. ${COMMON}`,
  },
];

async function main(): Promise<void> {
  for (const c of CANDIDATES) {
    console.log(`Generating ${c.name}…`);
    const result = await fal.subscribe('fal-ai/recraft/v3/text-to-image', {
      input: {
        prompt: c.prompt,
        image_size: 'square_hd',
        style: 'digital_illustration',
      },
      logs: false,
    });
    const data = result.data as { images?: Array<{ url: string }> };
    const url = data.images?.[0]?.url;
    if (!url) {
      console.error(`  no image for ${c.name}`);
      continue;
    }
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const path = `${OUT_DIR}/${c.name}.png`;
    writeFileSync(path, buf);
    console.log(`  ${path} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
