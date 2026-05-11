// Push notification setup. We use expo-notifications dynamically so the rest
// of the app builds even before the native module is installed.
import { Platform } from 'react-native';
import * as api from './api';

let registered = false;

// Show alerts and play sound while the app is foregrounded.
async function configureHandler(Notifications: typeof import('expo-notifications')): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowAlert: true,
    }),
  });
}

export async function registerForPushNotifications(): Promise<void> {
  if (registered) return;
  let Notifications: typeof import('expo-notifications');
  try {
    Notifications = await import('expo-notifications');
  } catch {
    // Module not installed (e.g. running tests). Silently skip.
    return;
  }

  await configureHandler(Notifications);

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: 4, // HIGH
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    if (token?.data) {
      await api.registerPushToken(token.data);
      registered = true;
    }
  } catch (err) {
    // Common when running on an emulator without FCM, in Expo Go on a dev
    // account, etc. Failing silently is fine — we'll retry next launch.
    console.warn('[push] failed to register token', err);
  }
}

// Hook a tap on a notification → navigate. The navigator passes a `navigate`
// callback so this module stays decoupled from the navigation container.
export async function attachNotificationTapHandler(
  navigate: (route: 'Follow' | 'Feed' | 'FollowedSessionDetail', params?: Record<string, unknown>) => void,
): Promise<() => void> {
  let Notifications: typeof import('expo-notifications');
  try {
    Notifications = await import('expo-notifications');
  } catch {
    return () => {};
  }

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    const category = typeof data.category === 'string' ? data.category : '';
    if (category === 'follow_request') {
      navigate('Follow');
    } else if (category === 'follow_accepted') {
      navigate('Feed');
    } else if (category === 'new_session') {
      const sessionId = typeof data.session_id === 'string' ? data.session_id : null;
      if (sessionId) navigate('FollowedSessionDetail', { sessionId });
      else navigate('Feed');
    }
  });
  return () => sub.remove();
}
