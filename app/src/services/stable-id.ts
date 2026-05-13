// Persistent client-side identifier — survives app reinstall on the
// same physical device so re-registration recovers the existing user
// (same magic_id, same follows, same trial entitlement) instead of
// minting a fresh row + a fresh free-trial session.
//
// Platform strategies:
//
//   iOS    — store a freshly minted uuid in the Keychain via
//            expo-secure-store. iOS Keychain entries persist across
//            app uninstall by default (since iOS 11), so the same
//            uuid comes back on reinstall.
//
//   Android — derive a uuidv5 from Settings.Secure.ANDROID_ID with an
//            app-private namespace. ANDROID_ID survives reinstall on
//            the same user × app-signing-key × device tuple, so the
//            derived uuid is stable. The raw ANDROID_ID never leaves
//            the device — only the namespaced hash is sent to the server.
//
// Both paths return a uuid string. Returns null if the platform
// primitive isn't available (e.g. iOS simulator with Keychain disabled,
// or Android device that returns no ANDROID_ID). Callers must tolerate
// null and fall through to the legacy "mint a random uuid" path.

import { Platform } from 'react-native';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

// Generated once. Used as the uuidv5 namespace for Android ANDROID_ID
// derivation, so two installs of *this* app on the same device produce
// the same uuid, but the same ANDROID_ID across two different apps
// would produce different uuids. (No raw cross-app linkability.)
const APP_NAMESPACE = '6f1c5b3a-2c9b-4e1f-9c3a-7a2e9d1f4a5b';

const KEYCHAIN_KEY = 'livestylist.stable_device_id';

// Concurrent callers (e.g. getDeviceId() racing register() during
// onboarding) would otherwise both observe the missing Keychain entry,
// each mint a different uuidv4, and the second setItemAsync would
// overwrite the first — leaving them holding different "stable" ids
// for this launch. Cache the in-flight promise so all callers await
// the same resolution. Cleared after settle so a transient failure
// (Keychain locked at startup) can be retried later.
let inflight: Promise<string | null> | null = null;

/**
 * Returns the stable device id for this install, creating it if missing.
 * Idempotent: subsequent calls return the same uuid for the same
 * physical device.
 */
export async function getStableDeviceId(): Promise<string | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      if (Platform.OS === 'ios') {
        return await getOrCreateIosStableId();
      }
      if (Platform.OS === 'android') {
        return await getAndroidStableId();
      }
      // Web / other — no stable persistence path. Caller falls back.
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function getOrCreateIosStableId(): Promise<string | null> {
  let SecureStore: typeof import('expo-secure-store');
  try {
    SecureStore = await import('expo-secure-store');
  } catch {
    return null;
  }
  try {
    const existing = await SecureStore.getItemAsync(KEYCHAIN_KEY);
    if (existing) return existing;
    const fresh = uuidv4();
    await SecureStore.setItemAsync(KEYCHAIN_KEY, fresh, {
      // Default accessibility is WHEN_UNLOCKED, which persists across
      // app uninstall. We don't sync to iCloud — the id is per-device.
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    return fresh;
  } catch {
    return null;
  }
}

async function getAndroidStableId(): Promise<string | null> {
  let Application: typeof import('expo-application');
  try {
    Application = await import('expo-application');
  } catch {
    return null;
  }
  try {
    const androidId = Application.getAndroidId();
    if (!androidId) return null;
    return uuidv5(androidId, APP_NAMESPACE);
  } catch {
    return null;
  }
}
