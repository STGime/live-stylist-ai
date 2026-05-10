import 'dotenv/config';
import { generateStylePreview } from '../src/services/image-generation.service.js';

// 1x1 transparent PNG (base64) as a no-op source
const TINY = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==';

async function main(): Promise<void> {
  const out = await generateStylePreview({
    sourceImage: TINY,
    prompt: 'add a small red dot to the center',
  });
  console.log('ok');
  console.log('  mime:', out.mimeType);
  console.log('  bytes:', Buffer.from(out.image, 'base64').byteLength);
  console.log('  ms:', out.processingTimeMs);
  if (out.description) console.log('  desc:', out.description.slice(0, 120));
}

main().catch((e) => {
  console.error('FAIL:', e?.message || e);
  process.exit(1);
});
