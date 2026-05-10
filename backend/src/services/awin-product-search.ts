/**
 * Awin Product Search API client with region-based merchant filtering.
 *
 * Searches the Awin product datafeed for beauty/style products
 * and returns affiliate-linked results filtered by EU or US merchants.
 */

import { logger } from '../utils/logger.js';
import { getEnv } from '../config/env.js';

export interface ProductResult {
  id: string;
  name: string;
  brand: string;
  price: string;
  currency: string;
  imageUrl: string;
  affiliateUrl: string;
  merchant: string;
  region: 'eu' | 'us';
}

export type ProductRegion = 'eu' | 'us';

// Awin Advertiser IDs per region.
// Find these in your Awin dashboard → Advertiser Directory → each approved merchant's detail page.
// Steps: awin.com → login → Advertisers → search retailer name → copy "Advertiser ID" number.
const EU_MERCHANTS: number[] = [
  // Douglas         → Awin Advertiser ID: ______
  // Cult Beauty     → Awin Advertiser ID: ______
  // LookFantastic   → Awin Advertiser ID: ______
  // Sephora EU      → Awin Advertiser ID: ______
  // Flaconi         → Awin Advertiser ID: ______
  // ASOS            → Awin Advertiser ID: ______
];

const US_MERCHANTS: number[] = [
  // Sephora US      → Awin/ShareASale Advertiser ID: ______
  // Ulta Beauty     → Awin/ShareASale Advertiser ID: ______
  // Nordstrom       → Awin/ShareASale Advertiser ID: ______
  // Macy's          → Awin/ShareASale Advertiser ID: ______
  // Target          → Awin/ShareASale Advertiser ID: ______
];

const MERCHANT_IDS: Record<ProductRegion, number[]> = {
  eu: EU_MERCHANTS,
  us: US_MERCHANTS,
};

// Simple TTL cache: key → { data, expiresAt }
const cache = new Map<string, { data: ProductResult[]; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCacheKey(query: string, region: ProductRegion): string {
  return `${region}:${query.toLowerCase().trim()}`;
}

function getFromCache(key: string): ProductResult[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: ProductResult[]): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });

  // Evict old entries if cache grows too large
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiresAt) cache.delete(k);
    }
  }
}

/**
 * Search for products via the Awin Product Search API.
 * Results are filtered by region-specific merchant IDs.
 */
export async function searchProducts(
  query: string,
  region: ProductRegion,
  limit = 6,
): Promise<ProductResult[]> {
  const cacheKey = getCacheKey(query, region);
  const cached = getFromCache(cacheKey);
  if (cached) {
    logger.info({ query, region, cached: true }, 'Product search cache hit');
    return cached.slice(0, limit);
  }

  const env = getEnv();
  const apiToken = env.AWIN_API_TOKEN;
  const affiliateId = env.AWIN_AFFILIATE_ID;

  if (!apiToken || !affiliateId) {
    logger.warn('Awin API credentials not configured, skipping product search');
    return [];
  }

  const merchantIds = MERCHANT_IDS[region];
  if (merchantIds.length === 0) {
    logger.warn({ region }, 'No merchant IDs configured for region');
    return [];
  }

  try {
    const merchantFilter = merchantIds.join(',');
    const url = `https://productdata.awin.com/datafeed/list/apikey/${apiToken}` +
      `?publisherId=${affiliateId}` +
      `&merchantIds=${merchantFilter}` +
      `&keyword=${encodeURIComponent(query)}` +
      `&categoryName=beauty` +
      `&nResults=${limit}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      logger.error({ status: response.status, query, region }, 'Awin API error');
      return [];
    }

    const data = await response.json() as any[];

    const products: ProductResult[] = (data || []).slice(0, limit).map((item: any) => ({
      id: String(item.aw_product_id || item.product_id || ''),
      name: item.product_name || item.title || '',
      brand: item.brand_name || item.brand || '',
      price: item.search_price || item.price || '',
      currency: item.currency || (region === 'us' ? 'USD' : 'EUR'),
      imageUrl: item.aw_image_url || item.merchant_image_url || '',
      affiliateUrl: item.aw_deep_link || item.affiliate_link || '',
      merchant: item.merchant_name || '',
      region,
    }));

    setCache(cacheKey, products);
    logger.info({ query, region, resultCount: products.length }, 'Product search completed');
    return products;
  } catch (error: any) {
    logger.error({ error: error.message, query, region }, 'Product search failed');
    return [];
  }
}
