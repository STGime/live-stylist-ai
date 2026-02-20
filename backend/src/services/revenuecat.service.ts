import { getEnv } from '../config/env';
import { logger } from '../utils/logger';
import type { SubscriptionTier } from '../types';

const REVENUECAT_BASE_URL = 'https://api.revenuecat.com/v1';
const PREMIUM_ENTITLEMENT_ID = 'premium';

interface RevenueCatSubscriberResponse {
  subscriber: {
    entitlements: Record<string, {
      expires_date: string | null;
      product_identifier: string;
    }>;
  };
}

export async function checkEntitlement(deviceId: string): Promise<SubscriptionTier> {
  const env = getEnv();

  try {
    const response = await fetch(`${REVENUECAT_BASE_URL}/subscribers/${encodeURIComponent(deviceId)}`, {
      headers: {
        'Authorization': `Bearer ${env.REVENUECAT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.info({ deviceId }, 'RevenueCat subscriber not found, defaulting to free');
        return 'free';
      }
      logger.warn({ deviceId, status: response.status }, 'RevenueCat API error');
      return 'free';
    }

    const data = (await response.json()) as RevenueCatSubscriberResponse;
    const premium = data.subscriber.entitlements[PREMIUM_ENTITLEMENT_ID];

    if (!premium) return 'free';

    // Check if entitlement is still active (not expired)
    if (premium.expires_date) {
      const expiresAt = new Date(premium.expires_date);
      if (expiresAt < new Date()) return 'free';
    }

    logger.info({ deviceId }, 'User has premium entitlement');
    return 'premium';
  } catch (error) {
    logger.error({ deviceId, error }, 'RevenueCat check failed, defaulting to free');
    return 'free';
  }
}
