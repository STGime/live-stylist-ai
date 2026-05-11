import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { DialogProvider } from './src/components/AppDialog';

// Note: Sentry init, expo-splash-screen, and RevenueCat configure were
// removed from boot path while debugging an iOS startup SIGABRT. They will
// be re-added one at a time once the bare-app boots successfully on iOS.
// PaywallScreen still imports billing locally so the purchase path works
// when the user actually navigates there.

export default function App() {
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
