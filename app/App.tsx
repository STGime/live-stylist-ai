import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { DialogProvider } from './src/components/AppDialog';

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

function App() {
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
