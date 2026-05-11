import { randomBytes } from 'crypto';

// Base32 alphabet without confusing characters (no 0/O/1/I/L).
// 10 chars from 32 symbols → 32^10 ≈ 10^15 combos; collisions effectively
// impossible at the scale of this app, but db.service still retries on
// unique-violation just in case.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ID_LENGTH = 10;

export function generateMagicId(): string {
  const bytes = randomBytes(ID_LENGTH);
  let id = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}

const MAGIC_ID_PATTERN = new RegExp(`^[${ALPHABET}]{${ID_LENGTH}}$`);

export function isValidMagicId(value: string): boolean {
  return MAGIC_ID_PATTERN.test(value);
}

// Loose normalizer for user-typed input — uppercase + strip whitespace and
// dashes so "abcd-efgh-ij" or "abcdefghij " both work.
export function normalizeMagicId(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, '');
}
