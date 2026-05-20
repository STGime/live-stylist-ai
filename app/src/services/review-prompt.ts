// Decides when to ask the user for a store review.
//
// Trigger schedule:
//   - After session 1.
//   - After every 2nd session thereafter (sessions 3, 5, 7, ...) until the
//     user has tapped "Sure" on the pre-prompt (`satisfied` flag).
//
// We can't observe what the user does inside the OS-native review prompt
// (Apple/Google both treat it as opaque — by design). "Satisfied" really
// means "the user expressed positive intent on our custom pre-prompt"; the
// native rate-limiter (3/365d on iOS, similar on Android) handles whether
// anything actually appears after that point.
//
// State is per-device in AsyncStorage. Re-install resets the counter, which
// is acceptable: a returning user being asked again after a reinstall isn't
// noticeably worse UX than the OS-level rate limit already does silently.

import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_COUNT_KEY = '@livestylist_review_session_count';
const SATISFIED_KEY = '@livestylist_review_satisfied';

/** Bump the per-device session count by 1 and return the new value.
 *  Called once per Session Summary screen mount. */
export async function incrementSessionCount(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(SESSION_COUNT_KEY);
    const next = (Number(stored) || 0) + 1;
    await AsyncStorage.setItem(SESSION_COUNT_KEY, String(next));
    return next;
  } catch {
    // Storage failure shouldn't surface to the user. Returning 0 means
    // shouldShowReviewPrompt will say no — fine for a degraded run.
    return 0;
  }
}

/** True when this session number is a review-prompt trigger AND the user
 *  hasn't already opted into reviewing. Trigger numbers are 1, 3, 5, ... */
export async function shouldShowReviewPrompt(sessionCount: number): Promise<boolean> {
  if (sessionCount < 1) return false;
  // 1, 3, 5, ...  → odd numbers.
  if (sessionCount % 2 === 0) return false;
  try {
    const satisfied = await AsyncStorage.getItem(SATISFIED_KEY);
    return satisfied !== '1';
  } catch {
    // Default to false on storage failure — better to skip the prompt
    // than to nag a user who already said yes.
    return false;
  }
}

/** Record that the user tapped "Sure" on the pre-prompt. We won't ask
 *  again on this device. */
export async function markReviewSatisfied(): Promise<void> {
  try {
    await AsyncStorage.setItem(SATISFIED_KEY, '1');
  } catch {
    // Non-fatal — worst case, prompt re-appears on the next trigger
    // session. Native rate limiter will absorb it.
  }
}

/** Trigger the platform-native review prompt (SKStoreReviewController on
 *  iOS, Play In-App Review on Android). The OS controls whether anything
 *  actually appears — both platforms heavily rate-limit and silently
 *  no-op past that. We swallow errors so a missing native module (tests,
 *  expo-go without the plugin) doesn't crash the flow. */
export async function requestStoreReview(): Promise<void> {
  try {
    const StoreReview = await import('expo-store-review');
    const available = await StoreReview.isAvailableAsync();
    if (!available) return;
    // hasAction() is true on iOS device builds and on Play-installed
    // Android builds — false in simulators / sideloaded debug builds.
    // requestReview() itself is also safe to call when hasAction is false
    // (it just no-ops), but the extra check keeps the breadcrumb cleaner.
    const hasAction = await StoreReview.hasAction();
    if (!hasAction) return;
    await StoreReview.requestReview();
  } catch {
    // Native module unavailable (tests, missing native build) — silently
    // skip. The "Sure" tap has already flipped `satisfied` so we won't
    // bother the user about this again.
  }
}
