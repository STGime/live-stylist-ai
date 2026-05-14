import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { DialogProvider } from './src/components/AppDialog';
import { attachNotificationTapHandler } from './src/services/push';
import { configureBilling } from './src/services/billing';
import type { RootStackParamList } from './src/types';

// Sentry — required for the iOS startup-crash investigation. The DSN comes
// from EXPO_PUBLIC_SENTRY_DSN (baked into the build by EAS env block). If the
// app crashes before React mounts, Sentry's native SDK still captures it as
// long as `Sentry.init` runs at the top of the JS bundle.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    enableNative: true,
    enableNativeCrashHandling: true,
    debug: false,
  });
}

const navigationRef = createNavigationContainerRef<RootStackParamList>();

function App() {
  const detachRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    attachNotificationTapHandler((route, params) => {
      if (!navigationRef.isReady()) return;
      // @ts-ignore — push handler types stay decoupled from RootStackParamList
      navigationRef.navigate(route, params);
    }).then((detach) => {
      detachRef.current = detach;
    });
    return () => {
      detachRef.current?.();
    };
  }, []);

  // Initialise the RC SDK once at startup so isPremium() / Paywall don't
  // each pay a configure round-trip on first call. configureBilling is
  // a no-op when keys aren't set (Android until Play products land), so
  // this safely runs on every launch regardless of platform.
  useEffect(() => {
    configureBilling().catch((err) => {
      console.warn('[App] configureBilling failed', err);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <DialogProvider>
        <NavigationContainer ref={navigationRef}>
          <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
          <AppNavigator />
        </NavigationContainer>
      </DialogProvider>
    </SafeAreaProvider>
  );
}

export default SENTRY_DSN ? Sentry.wrap(App) : App;
