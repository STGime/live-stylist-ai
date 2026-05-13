// Push notification setup. We use expo-notifications dynamically so the rest
// of the app builds even before the native module is installed.
import { Platform } from 'react-native';
import * as api from './api';

let registered = false;

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** OS-level permission status, without prompting. Used by the Profile
 *  toggle to decide whether "Turn on" can proceed or has to redirect the
 *  user to system Settings. */
export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  let Notifications: typeof import('expo-notifications');
  try {
    Notifications = await import('expo-notifications');
  } catch {
    return 'unavailable';
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/** Stop sending push to this device. Clears the row server-side; the OS-level
 *  permission stays as-is so the toggle can be re-flipped without another prompt. */
export async function unregisterPushNotifications(): Promise<void> {
  registered = false;
  await api.clearPushToken();
}

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

/**
 * Register this device with the push backend.
 *
 * Idempotent — guarded by an in-memory flag so callers can sprinkle the call
 * over any social action without worrying about re-prompting. Pass
 * `{ force: true }` to bypass the cache (e.g. when the user explicitly flips
 * the Profile "Notifications" toggle back on).
 */
export async function registerForPushNotifications(opts: { force?: boolean } = {}): Promise<void> {
  if (registered && !opts.force) return;
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
