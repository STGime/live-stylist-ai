/**
 * RevenueCat wrapper. The backend's revenuecat.service.ts queries by deviceId,
 * so we must `Purchases.configure({ appUserID: deviceId })` to keep the IDs in
 * sync.
 *
 * Note: API keys are placeholders until the apps are live in App Store Connect
 * and Play Console and a RevenueCat project has been created. See plan §6.
 */
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { getDeviceId } from './api';

const ENTITLEMENT_ID = 'premium';

// Public SDK keys from the RevenueCat dashboard (Project settings → API
// keys → "Apple SDK key" / "Google SDK key"). These are the public-facing
// keys, intended to be embedded in client bundles — they're not secrets,
// so committing them is fine. The matching server-side REST API key
// lives on Cloud Run as the REVENUECAT_API_KEY env var (different key).
const APPLE_KEY = 'appl_gAIokSuKhVsvHCvXtimKxBxLdcy';
const GOOGLE_KEY = 'goog_MsmMVhcNUdRaihLmXFkwcJtGMUp';

let configured = false;
// Concurrent callers (e.g. App.tsx kicking configureBilling on startup
// while HomeScreen's focus effect races to call isPremium) would
// otherwise each observe configured=false and skip the configure step
// — or worse, both call Purchases.configure twice. Cache the in-flight
// promise so every caller awaits the same resolution. Cleared after
// settle so a transient failure can be retried by a later call.
let configuring: Promise<void> | null = null;

// Surfaced to PaywallScreen so the user sees *why* purchases are
// unavailable rather than a generic "not yet available" message.
// One of:
//   'no_key'             — APPLE_KEY/GOOGLE_KEY empty in this build
//   'configure_failed'   — Purchases.configure threw (network, invalid key, bundle mismatch)
//   'no_offering'        — RC has no current offering, or product still
//                          missing metadata in the store
//   null                 — everything's fine
export type BillingFailureReason = 'no_key' | 'configure_failed' | 'no_offering' | null;
let lastFailure: BillingFailureReason = null;
let lastFailureMessage = '';

export function isBillingConfigured(): boolean {
  return configured;
}

export function getBillingFailure(): { reason: BillingFailureReason; message: string } {
  return { reason: lastFailure, message: lastFailureMessage };
}

export async function configureBilling(): Promise<void> {
  if (configured) return;
  if (configuring) return configuring;
  configuring = (async () => {
    try {
      const apiKey = Platform.OS === 'ios' ? APPLE_KEY : GOOGLE_KEY;
      if (!apiKey) {
        lastFailure = 'no_key';
        lastFailureMessage = `No RevenueCat ${Platform.OS} SDK key in build`;
        console.warn('[Billing] No RevenueCat API key set — purchases disabled.');
        return;
      }
      Purchases.setLogLevel(LOG_LEVEL.WARN);
      const appUserID = await getDeviceId();
      try {
        await Purchases.configure({ apiKey, appUserID });
        configured = true;
        lastFailure = null;
        lastFailureMessage = '';
      } catch (err: any) {
        lastFailure = 'configure_failed';
        lastFailureMessage = err?.message ?? String(err);
        console.warn('[Billing] Purchases.configure failed:', lastFailureMessage);
        throw err;
      }
    } finally {
      configuring = null;
    }
  })();
  return configuring;
}

/** If a configure is in flight, wait for it. Avoids cold-start races
 *  where Home's first focus effect fires isPremium() before App.tsx's
 *  configureBilling() has finished awaiting getDeviceId(). */
async function awaitConfiguration(): Promise<void> {
  if (configuring) await configuring;
}

export async function getDefaultOffering(): Promise<PurchasesOffering | null> {
  await awaitConfiguration();
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  const current = offerings.current ?? null;
  if (!current || current.availablePackages.length === 0) {
    // Most common cause in production: the RC `default` offering hasn't
    // been created OR the App Store Connect product is still pending
    // metadata / review, so StoreKit hasn't returned a SKProduct for it.
    lastFailure = 'no_offering';
    lastFailureMessage = current
      ? `Offering "${current.identifier}" has no packages`
      : 'No "current" offering set in RevenueCat dashboard';
  } else {
    // Success path must clear any prior failure so /getBillingFailure
    // doesn't keep reporting a stale `no_offering` after the RC dashboard
    // is fixed mid-session.
    lastFailure = null;
    lastFailureMessage = '';
  }
  return current;
}

export async function purchase(pkg: PurchasesPackage): Promise<CustomerInfo> {
  await awaitConfiguration();
  if (!configured) throw new Error('Billing not configured');
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restore(): Promise<CustomerInfo> {
  await awaitConfiguration();
  if (!configured) throw new Error('Billing not configured');
  return Purchases.restorePurchases();
}

export async function isPremium(): Promise<boolean> {
  await awaitConfiguration();
  if (!configured) return false;
  const info = await Purchases.getCustomerInfo();
  return info.entitlements.active[ENTITLEMENT_ID] != null;
}
