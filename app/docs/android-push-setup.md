# Android push notifications — setup checklist

The in-app **Notifications** toggle (Profile screen) and the just-in-time
prompts on FollowScreen will work the same on Android as on iOS *in code*,
but Android needs a few platform-side pieces before pushes actually
deliver. Status as of 2026-05-13:

## ✅ Already in place

- `expo-notifications` is in `app.json` `plugins`.
- `AndroidManifest.xml` declares `android.permission.POST_NOTIFICATIONS`
  (Android 13+ runtime permission). Mirrored in `app.json` →
  `expo.android.permissions` so a future `expo prebuild` preserves it.
- Default notification channel is created at runtime (`Notifications.setNotificationChannelAsync('default', …)` in `app/src/services/push.ts`).
- Backend `app_users.expo_push_token` column accepts and uses Android
  tokens identically to iOS.

## ⚠️ Still required for real push delivery on Android

Expo SDK 50+ removed the legacy Expo-managed FCM bridge for Android.
Production Android push now needs a Firebase / FCM **service account
key** uploaded to EAS:

1. **Create a Firebase project** (if one doesn't already exist) at
   <https://console.firebase.google.com>. Project ID doesn't matter as
   long as the Android app inside it has the right package name.
2. Add an Android app to it with package name `com.livestylist`. You can
   skip the `google-services.json` download — it isn't needed for
   Expo's push pipeline, only the service account key is.
3. **Generate a service-account key:** Firebase console → ⚙ Project
   settings → "Service accounts" tab → "Generate new private key" →
   download the JSON.
4. **Upload it to EAS:**
   ```bash
   eas credentials --platform android
   ```
   …pick the profile (start with `preview`), then "Push Notifications:
   Manage your Google Service Account Key for Push Notifications (FCM
   V1)" → "Upload a new service account key" → point at the JSON from
   step 3.

After step 4 the next preview / production EAS build mints real
`ExponentPushToken[...]` values on Android and pushes deliver. The
Profile toggle and the social just-in-time prompts both already handle
the token round-trip, so no code change is needed once credentials are
in place.

## What happens *before* step 4

- The Profile toggle's "Turn on" path runs to completion: it asks for OS
  permission (granted), tries to mint a token, and either gets nothing
  back or a sandbox token Expo rejects. The toggle then re-fetches
  `/profile` and sees `notifications_enabled: false`, so it flips back
  to Off and surfaces a clear alert about FCM credentials being missing.
- Nothing crashes; the app just doesn't deliver pushes on Android. iOS
  is unaffected.

## How to verify after setup

1. Run `eas credentials --platform android` and confirm the FCM V1 key
   is listed under the relevant profile.
2. Build + install a fresh preview APK.
3. Toggle Notifications on in Profile — should land on **On** without
   the "couldn't enable" alert.
4. Have a friend send you a follow request (or self-test from a second
   device). Notification arrives on the lock screen.
5. On the backend, `gcloud logging tail` should show a successful Expo
   push response (`status: ok`).
