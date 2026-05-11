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

// TODO: replace with real keys from RevenueCat dashboard once both stores
// have the products live. Until then `Purchases.configure` will throw on
// device — guarded by the `isBillingConfigured()` check below so the app
// keeps working in dev without the keys.
const APPLE_KEY = '';
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
