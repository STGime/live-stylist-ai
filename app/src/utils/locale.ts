import { Platform, NativeModules } from 'react-native';

/**
 * Best-effort read of the device locale (e.g. "de_DE", "en-US").
 *
 * iOS exposes it via SettingsManager; Android via I18nManager. Both can be
 * undefined on newer RN versions (constants have moved across releases), so we
 * fall back to "en_US". Centralised here so HomeScreen and OnboardingScreen
 * don't drift apart.
 */
export function getDeviceLocale(): string {
  return Platform.OS === 'ios'
    ? (NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        'en_US')
    : (NativeModules.I18nManager?.localeIdentifier || 'en_US');
}

/**
 * Default agent language from the device locale: German-language devices start
 * in Deutsch, everyone else in English. Matches on the *language* subtag only
 * (so de_AT / de_CH count as German, but en_DE does not). Only a starting
 * point — users can change it any time in Settings.
 */
export function detectDefaultLanguage(): 'en' | 'de' {
  return /^de([-_.]|$)/i.test(getDeviceLocale()) ? 'de' : 'en';
}
