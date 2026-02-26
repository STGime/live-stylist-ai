/**
 * Computes RMS amplitude from a base64-encoded PCM audio chunk.
 * PCM format: 16-bit signed little-endian mono.
 * Returns a value normalized to 0.0–1.0.
 */

import { Buffer } from 'buffer';

const INT16_MAX = 32768;

export function computeRmsAmplitude(base64Pcm: string): number {
  const raw = Buffer.from(base64Pcm, 'base64');
  const sampleCount = Math.floor(raw.length / 2);
  if (sampleCount === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = raw.readInt16LE(i * 2);
    const normalized = sample / INT16_MAX;
    sumSquares += normalized * normalized;
  }

  const rms = Math.sqrt(sumSquares / sampleCount);
  // Clamp to 0–1 (RMS of full-scale sine is ~0.707, so this rarely clips)
  return Math.min(1, rms);
}
