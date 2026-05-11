import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
import { DialogProvider } from './src/components/AppDialog';
import { configureBilling } from './src/services/billing';

// Sentry — DSN is optional. Without it, init is a no-op so dev builds don't
// require a Sentry project to start. Set EXPO_PUBLIC_SENTRY_DSN at build time
// (env var picked up by Expo CLI / EAS Build) to enable.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
}

// Keep the native splash visible until React mounts so there's no white flash.
SplashScreen.preventAutoHideAsync().catch(() => {});

function App() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    // Best-effort: configure RevenueCat. Silently no-ops if API keys aren't set.
    configureBilling().catch((e) =>
      console.warn('[App] configureBilling failed:', e?.message || e),
    );
  }, []);

  return (
    <SafeAreaProvider>
      <DialogProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
          <AppNavigator />
        </NavigationContainer>
      </DialogProvider>
    </SafeAreaProvider>
  );
}

export default SENTRY_DSN ? Sentry.wrap(App) : App;
