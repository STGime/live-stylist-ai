/**
 * Detects product-related mentions in coordinator transcript text
 * and builds search queries for the Awin Product Search API.
 *
 * Uses brand name + product category pattern matching with cooldown
 * to avoid spamming affiliate searches.
 */

import { logger } from '../utils/logger.js';

// Beauty brands to detect (case-insensitive)
const BRANDS = [
  'MAC', 'NARS', 'Charlotte Tilbury', 'Fenty', 'Fenty Beauty',
  'Urban Decay', 'Too Faced', 'Benefit', 'Tarte', 'Maybelline',
  'L\'Oreal', 'Revlon', 'NYX', 'Clinique', 'Estee Lauder',
  'Bobbi Brown', 'Laura Mercier', 'Dior', 'Chanel', 'YSL',
  'Tom Ford', 'Hourglass', 'Pat McGrath', 'Rare Beauty',
  'Glossier', 'Milk Makeup', 'Ilia', 'Kosas', 'Merit',
  'Drunk Elephant', 'The Ordinary', 'CeraVe', 'La Roche-Posay',
  'Olaplex', 'Dyson', 'GHD', 'Moroccanoil', 'Kerastase',
];

// Product categories to detect
const CATEGORIES = [
  'lipstick', 'lip liner', 'lip gloss', 'lip balm', 'lip stain',
  'foundation', 'concealer', 'powder', 'primer', 'setting spray',
  'blush', 'bronzer', 'highlighter', 'contour',
  'eyeshadow', 'eye shadow', 'eyeliner', 'eye liner', 'mascara',
  'brow pencil', 'brow gel', 'eyebrow',
  'moisturizer', 'serum', 'sunscreen', 'SPF', 'cleanser', 'toner',
  'hair oil', 'hair mask', 'shampoo', 'conditioner', 'dry shampoo',
  'straightener', 'curling iron', 'hair dryer', 'blow dryer',
  'perfume', 'fragrance', 'cologne',
  'nail polish', 'nail color',
  'makeup brush', 'beauty blender', 'sponge',
];

// Build regex patterns (compiled once)
const brandPatterns = BRANDS.map(b => ({
  name: b,
  regex: new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
}));

const categoryPatterns = CATEGORIES.map(c => ({
  name: c,
  regex: new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
}));

export interface ProductTriggerResult {
  query: string;
  brand: string | null;
  category: string | null;
}

/**
 * Analyze transcript text for product mentions.
 * Returns a search query if a brand and/or category is detected.
 */
export function detectProductMention(text: string): ProductTriggerResult | null {
  let detectedBrand: string | null = null;
  let detectedCategory: string | null = null;

  for (const { name, regex } of brandPatterns) {
    if (regex.test(text)) {
      detectedBrand = name;
      break;
    }
  }

  for (const { name, regex } of categoryPatterns) {
    if (regex.test(text)) {
      detectedCategory = name;
      break;
    }
  }

  // Need at least a brand OR a category to trigger
  if (!detectedBrand && !detectedCategory) {
    return null;
  }

  // Build search query: "brand category" or just whichever we have
  const parts = [detectedBrand, detectedCategory].filter(Boolean);
  const query = parts.join(' ');

  return { query, brand: detectedBrand, category: detectedCategory };
}

/**
 * Manages cooldown state for product triggers within a session.
 * Prevents excessive API calls during rapid conversation.
 */
export class ProductTriggerCooldown {
  private lastTriggerTime = 0;
  private readonly cooldownMs: number;

  constructor(cooldownMs = 15000) {
    this.cooldownMs = cooldownMs;
  }

  /**
   * Check if we can trigger a product search.
   * Returns true and updates timestamp if cooldown has elapsed.
   */
  canTrigger(): boolean {
    const now = Date.now();
    if (now - this.lastTriggerTime < this.cooldownMs) {
      return false;
    }
    this.lastTriggerTime = now;
    return true;
  }

  /**
   * Analyze transcript text and return a product query if:
   * 1. A product mention is detected
   * 2. Cooldown has elapsed
   */
  checkTranscript(text: string): ProductTriggerResult | null {
    const result = detectProductMention(text);
    if (!result) return null;

    if (!this.canTrigger()) {
      logger.info({ query: result.query }, 'Product trigger cooldown active, skipping');
      return null;
    }

    logger.info({ query: result.query, brand: result.brand, category: result.category }, 'Product mention detected');
    return result;
  }
}
