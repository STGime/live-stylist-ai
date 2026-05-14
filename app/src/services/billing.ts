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
//
// Google key still empty until the Play Console product is live and
// imported into the same RC project; configureBilling() guards against
// it being absent on Android so the app degrades gracefully.
const APPLE_KEY = 'appl_gAIokSuKhVsvHCvXtimKxBxLdcy';
const GOOGLE_KEY = '';

let configured = false;

export function isBillingConfigured(): boolean {
  return configured;
}

export async function configureBilling(): Promise<void> {
  if (configured) return;
  const apiKey = Platform.OS === 'ios' ? APPLE_KEY : GOOGLE_KEY;
  if (!apiKey) {
    console.warn('[Billing] No RevenueCat API key set — purchases disabled.');
    return;
  }
  Purchases.setLogLevel(LOG_LEVEL.WARN);
  const appUserID = await getDeviceId();
  await Purchases.configure({ apiKey, appUserID });
  configured = true;
}

export async function getDefaultOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export async function purchase(pkg: PurchasesPackage): Promise<CustomerInfo> {
  if (!configured) throw new Error('Billing not configured');
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restore(): Promise<CustomerInfo> {
  if (!configured) throw new Error('Billing not configured');
  return Purchases.restorePurchases();
}

export async function isPremium(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.getCustomerInfo();
  return info.entitlements.active[ENTITLEMENT_ID] != null;
}
