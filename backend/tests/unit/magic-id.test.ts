import { describe, it, expect } from 'vitest';
import {
  generateMagicId,
  isValidMagicId,
  normalizeMagicId,
} from '../../src/services/magic-id.service.js';

describe('magic-id service', () => {
  it('generates 10-char IDs in the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const id = generateMagicId();
      expect(id).toHaveLength(10);
      expect(id).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
      expect(isValidMagicId(id)).toBe(true);
    }
  });

  it('rejects malformed inputs', () => {
    expect(isValidMagicId('TOOSHORT')).toBe(false);
    expect(isValidMagicId('abcdefghij')).toBe(false); // lowercase
    expect(isValidMagicId('ABCDEFGHI1')).toBe(false); // contains 1
    expect(isValidMagicId('ABCDEFGHIO')).toBe(false); // contains O
  });

  it('normalizes user input', () => {
    expect(normalizeMagicId('  abcd-efgh-ij ')).toBe('ABCDEFGHIJ');
    expect(normalizeMagicId('abcdefghij')).toBe('ABCDEFGHIJ');
  });
});
