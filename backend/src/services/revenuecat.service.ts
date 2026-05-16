import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { SubscriptionTier } from '../types/index.js';

const REVENUECAT_BASE_URL = 'https://api.revenuecat.com/v1';
const PREMIUM_ENTITLEMENT_ID = 'premium';

// Short-TTL per-instance cache. /profile is hit on every Home focus
// and previously triggered a synchronous RC round-trip per call —
// multiplying our hit count against RC's per-project rate limit and
// adding ~100-200ms to p95 latency. A 60s cache barely returns stale
// data (a brand-new purchase needs ~1-2s to land in RC's backend
// anyway) but cuts the RC call rate ~30× for the common "user
// repeatedly opens Home" pattern. Cache resets on a new Cloud Run
// revision — acceptable, we only need to stop hammering RC.
const CACHE_TTL_MS = 60_000;
interface CachedEntitlement {
  tier: SubscriptionTier;
  resolvedAt: number;
}
const entitlementCache = new Map<string, CachedEntitlement>();

interface RevenueCatSubscriberResponse {
  subscriber: {
    entitlements: Record<string, {
      expires_date: string | null;
      product_identifier: string;
    }>;
  };
}

/** Inner resolver. Returns the tier when RC answers definitively
 *  (200 with/without entitlement, or 404 "no subscriber"); returns
 *  null on transient errors (5xx, network, JSON parse failure) so
 *  callers can decide between conservative-default (free) and
 *  fall-through-to-client-signal behavior. */
async function resolveEntitlement(deviceId: string): Promise<SubscriptionTier | null> {
  const env = getEnv();

  const cached = entitlementCache.get(deviceId);
  if (cached && Date.now() - cached.resolvedAt < CACHE_TTL_MS) {
    return cached.tier;
  }

  try {
    const response = await fetch(`${REVENUECAT_BASE_URL}/subscribers/${encodeURIComponent(deviceId)}`, {
      headers: {
        'Authorization': `Bearer ${env.REVENUECAT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      logger.info({ deviceId }, 'RevenueCat subscriber not found, returning free');
      entitlementCache.set(deviceId, { tier: 'free', resolvedAt: Date.now() });
      return 'free';
    }
    if (!response.ok) {
      // Distinct from 404: this is a transient error (5xx, 429, etc.).
      // Don't cache, don't collapse to 'free' — let the caller decide.
      logger.warn({ deviceId, status: response.status }, 'RevenueCat API error — entitlement unresolved');
      return null;
    }

    const data = (await response.json()) as RevenueCatSubscriberResponse;
    const premium = data.subscriber.entitlements[PREMIUM_ENTITLEMENT_ID];

    let tier: SubscriptionTier = 'free';
    if (premium) {
      const expired = premium.expires_date && new Date(premium.expires_date) < new Date();
      if (!expired) tier = 'premium';
    }
    entitlementCache.set(deviceId, { tier, resolvedAt: Date.now() });
    if (tier === 'premium') logger.info({ deviceId }, 'User has premium entitlement');
    return tier;
  } catch (error) {
    logger.error({ deviceId, error }, 'RevenueCat check failed — entitlement unresolved');
    return null;
  }
}

/** Conservative tier check for session-gating paths (`/start-session`).
 *  Errors collapse to 'free' so a flaky RC can't accidentally hand
 *  out free unlimited sessions. */
export async function checkEntitlement(deviceId: string): Promise<SubscriptionTier> {
  const tier = await resolveEntitlement(deviceId);
  return tier ?? 'free';
}

/** Diagnostic tier check for read-only paths (`/profile`). Returns
 *  null when RC was unreachable — caller should omit tier fields
 *  rather than asserting 'free', so the app can fall back to its
 *  own on-device RC SDK signal instead of being lied to during an
 *  RC outage. */
export async function tryCheckEntitlement(deviceId: string): Promise<SubscriptionTier | null> {
  return resolveEntitlement(deviceId);
}
