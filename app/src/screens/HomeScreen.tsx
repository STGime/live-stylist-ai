import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  ScrollView,
  Linking,
  Switch,
  NativeModules,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera } from 'react-native-vision-camera';
import { COLORS } from '../theme/colors';
import BubbleButton from '../components/BubbleButton';
import FloatingBubbles from '../components/FloatingBubbles';
import ProfileModal from '../components/ProfileModal';
import HelpOverlay from '../components/HelpOverlay';
import OccasionPicker from '../components/OccasionPicker';
import * as api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList, UserProfile, Occasion, ProductRegion } from '../types';
import { useDialog } from '../components/AppDialog';

const HELP_SEEN_KEY = '@livestylist_help_seen';

// Per-launch latch for the stable-id retrofit. If /me/link-stable-id ever
// returns 409 (the row already has a different stable_id, e.g. user moved
// phones with the same iCloud account), without this we'd refire the
// failing call on every Home-screen mount. One attempt per launch is
// plenty; a real fix needs a backend / support intervention anyway.
let stableIdRetrofitTriedThisLaunch = false;

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionsRemaining, setSessionsRemaining] = useState(0);
  const [totalSessions, setTotalSessions] = useState(1);
  const [isPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [productRegion, setProductRegion] = useState<ProductRegion>('us');
  const [showProducts, setShowProducts] = useState(true);
  const [pendingFollowCount, setPendingFollowCount] = useState(0);
  const dialog = useDialog();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const [dailyPulseOn, setDailyPulseOn] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const p = await api.getProfile();
      setProfile(p);
      // Tier model: free = 1 lifetime trial, premium = 30/mo soft cap.
      // The remaining-sessions UI is informational; the backend is the source of truth.
      const limit = isPremium ? 30 : 1;
      const used = !isPremium && p.trial_used ? 1 : 0;
      setTotalSessions(limit);
      setSessionsRemaining(Math.max(0, limit - used));

      // Load product preferences
      const savedRegion = await AsyncStorage.getItem('@livestylist_product_region');
      const savedShowProducts = await AsyncStorage.getItem('@livestylist_show_products');
      if (savedRegion === 'eu' || savedRegion === 'us') {
        setProductRegion(savedRegion);
      } else {
        // Auto-detect region from device locale
        const locale = Platform.OS === 'ios'
          ? (NativeModules.SettingsManager?.settings?.AppleLocale || NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] || 'en_US')
          : (NativeModules.I18nManager?.localeIdentifier || 'en_US');
        const isEU = /^(de|fr|it|es|nl|pt|pl|sv|da|fi|no|cs|hu|ro|bg|hr|sk|sl|et|lv|lt|el|ga)/.test(locale) || /_?(AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|GR|HU|IE|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE|GB|UK)$/i.test(locale);
        const detected: ProductRegion = isEU ? 'eu' : 'us';
        setProductRegion(detected);
        await AsyncStorage.setItem('@livestylist_product_region', detected);
      }
      if (savedShowProducts !== null) {
        setShowProducts(savedShowProducts !== 'false');
      }

      // Pending follow requests for the badge — fire-and-forget, the badge
      // just disappears next refresh if this fails.
      api.listPendingFollows()
        .then((rows) => setPendingFollowCount(rows.length))
        .catch(() => setPendingFollowCount(0));

      // Retrofit the platform-stable id onto pre-existing users so the
      // *next* reinstall recovers their row (same magic_id / trial /
      // follows) instead of minting a fresh free-trial account. New
      // users go through the stable-id path during /register already,
      // so this fires only for users created before the upgrade. Guard
      // with a per-launch latch so a 409 doesn't loop on every focus.
      if (p.has_stable_device_id === false && !stableIdRetrofitTriedThisLaunch) {
        stableIdRetrofitTriedThisLaunch = true;
        api.linkStableDeviceId().catch((err) => {
          console.warn('[stable-id] retrofit failed', err?.status ?? '', err?.message ?? err);
        });
      }

      // Push permission is asked just-in-time on the first social action
      // (Follow screen: send / accept / share magic ID) rather than blindly
      // on every Home mount. Way more likely to be granted that way.
    } catch (err: any) {
      if (err.status === 404) {
        navigation.replace('Onboarding');
        return;
      }
      await dialog.alert({ title: 'Couldn\'t load profile', message: 'Please check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  }, [isPremium, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, delay: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, delay: 200, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    // Color-pulse on the word "daily" in two places (upgrade banner + sessions
    // pill when exhausted). Tried Animated.timing on color with useNativeDriver:
    // false — flaky on RN New Arch + Hermes. setInterval+state toggle is
    // bulletproof: re-renders every 700ms, instant snap between two gold shades.
    const t = setInterval(() => setDailyPulseOn((p) => !p), 700);
    return () => clearInterval(t);
  }, []);

  // First-launch tour. Run once after Home mounts; if the AsyncStorage flag
  // is unset, show the overlay. Recovery (PR #11) pre-sets the flag so
  // returning users on a fresh install don't see it again. Deferred a tick
  // so it doesn't fight the navigation-into-Home animation.
  useEffect(() => {
    let cancelled = false;
    requestAnimationFrame(async () => {
      try {
        const seen = await AsyncStorage.getItem(HELP_SEEN_KEY);
        if (!cancelled && !seen) setHelpVisible(true);
      } catch {
        // Storage unreachable — don't pop the overlay; we'll try next launch.
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleHelpDismiss = async (dontShowAgain: boolean) => {
    setHelpVisible(false);
    try {
      if (dontShowAgain) {
        await AsyncStorage.setItem(HELP_SEEN_KEY, '1');
      } else {
        // User explicitly unchecked — let it pop next launch too.
        await AsyncStorage.removeItem(HELP_SEEN_KEY);
      }
    } catch {
      // Non-fatal — worst case, modal reappears next launch.
    }
  };

  const handleShowHelpFromProfile = () => {
    // ProfileModal closes first; iOS can't reliably present a Modal on
    // top of another Modal (same workaround the delete-account path uses).
    setProfileModalVisible(false);
    setTimeout(() => setHelpVisible(true), 300);
  };

  const dailyAccentColor = dailyPulseOn ? COLORS.gold : '#8a6a2c';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Hey there' : 'Good evening';

  const handleStartSession = async () => {
    setStarting(true);
    try {
      // Ensure camera + mic permissions before launching
      const camStatus = await Camera.requestCameraPermission();
      const micStatus = await Camera.requestMicrophonePermission();

      if (camStatus !== 'granted' || micStatus !== 'granted') {
        const ok = await dialog.confirm({
          title: 'Permissions Needed',
          message: 'LiveStylist needs camera and microphone access to work. Open settings to enable them?',
          cancelLabel: 'Not now',
          confirmLabel: 'Open Settings',
        });
        if (ok) Linking.openSettings();
        setStarting(false);
        return;
      }

      const session = await api.startSession(selectedOccasion ?? undefined, showProducts ? productRegion : undefined);
      navigation.navigate('LiveSession', {
        sessionId: session.session_id,
        expiryTime: session.session_expiry_time,
        wsUrl: session.ws_url,
      });
    } catch (err: any) {
      if (err.status === 402 || err.code === 'trial_used' || err.code === 'monthly_cap') {
        const reason: 'trial_used' | 'monthly_cap' =
          err.code === 'monthly_cap' ? 'monthly_cap' : 'trial_used';
        navigation.navigate('Paywall', { reason });
      } else if (err.code === 'session_limit_exceeded') {
        // Legacy code path — older backend revisions returned this.
        navigation.navigate('Paywall', { reason: 'trial_used' });
      } else {
        await dialog.alert({ title: 'Couldn\'t start session', message: err.message || 'Please try again.' });
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <LinearGradient
      colors={[COLORS.cream, COLORS.pinkPale, COLORS.offWhite]}
      locations={[0, 0.6, 1]}
      style={styles.container}>
      <FloatingBubbles count={18} />
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.tierBadge,
            isPremium ? styles.tierBadgePremium : null,
          ]}>
          <Text
            style={[
              styles.tierText,
              isPremium ? styles.tierTextPremium : null,
            ]}>
            {isPremium ? 'Premium' : 'Free'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setProfileModalVisible(true)}
          style={styles.profileButton}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={8} r={4} stroke={COLORS.pink} strokeWidth={2.5} />
            <Path
              d="M4 21C4 17.134 7.582 14 12 14C16.418 14 20 17.134 20 21"
              stroke={COLORS.pink}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.pink} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(20, insets.bottom + 16) }]}>
            {/* Greeting */}
            <View style={styles.greeting}>
              <Text style={styles.greetingText}>
                {greeting},{'\n'}{profile?.name}!
              </Text>
              <Text style={styles.greetingSub}>Ready for your style sesh?</Text>
            </View>

            {/* Session Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <LinearGradient
                  colors={
                    sessionsRemaining > 0
                      ? [COLORS.pinkSoft, COLORS.lavenderSoft]
                      : [COLORS.grayLight, COLORS.grayLight]
                  }
                  style={styles.cardIcon}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M15 10L19.553 7.724C20.278 7.362 21 7.868 21 8.618V15.382C21 16.132 20.278 16.638 19.553 16.276L15 14M5 18H13C14.105 18 15 17.105 15 16V8C15 6.895 14.105 6 13 6H5C3.895 6 3 6.895 3 8V16C3 17.105 3.895 18 5 18Z"
                      stroke={sessionsRemaining > 0 ? COLORS.pink : COLORS.textMuted}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </LinearGradient>
                <View>
                  <Text style={styles.cardTitle}>Live Style Session</Text>
                  <Text style={styles.cardSubtitle}>5 min &bull; Camera + Voice</Text>
                </View>
              </View>

              {/* Sessions pill — tap when empty goes to the paywall. */}
              {sessionsRemaining > 0 ? (
                <View
                  style={[
                    styles.sessionsPill,
                    { backgroundColor: COLORS.green + '12', borderColor: COLORS.green + '30' },
                  ]}>
                  <Text style={[styles.sessionsText, { color: COLORS.green }]}>
                    {`${sessionsRemaining} of ${totalSessions} session${sessionsRemaining !== 1 ? 's' : ''} left`}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('Paywall', { reason: 'trial_used' })}
                  style={[
                    styles.sessionsPill,
                    { backgroundColor: COLORS.gold + '15', borderColor: COLORS.gold + '30' },
                  ]}>
                  <Text style={[styles.sessionsText, { color: COLORS.gold }]}>
                    Upgrade for{' '}
                    <Text style={{ fontWeight: '800', color: dailyAccentColor }}>
                      daily
                    </Text>
                    {' '}sessions
                  </Text>
                </TouchableOpacity>
              )}

              <OccasionPicker
                selected={selectedOccasion}
                onSelect={setSelectedOccasion}
              />

              <BubbleButton
                onPress={handleStartSession}
                disabled={starting}>
                {starting ? 'Starting...' : 'Start Session!'}
              </BubbleButton>

              <Text style={styles.consentNote}>
                By starting, you agree to our{' '}
                <Text style={styles.consentLink} onPress={() => Linking.openURL('https://livestylist.app/terms')}>
                  Terms
                </Text>
                {' & '}
                <Text style={styles.consentLink} onPress={() => Linking.openURL('https://livestylist.app/privacy')}>
                  Privacy Policy
                </Text>
              </Text>
            </View>

            {/* Friends + Feed shortcuts */}
            <View style={styles.shortcutRow}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Follow')}
                style={styles.shortcutButton}
                activeOpacity={0.7}>
                <Text style={styles.shortcutText}>Friends</Text>
                {pendingFollowCount > 0 && (
                  <View style={styles.shortcutBadge}>
                    <Text style={styles.shortcutBadgeText}>{pendingFollowCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('Feed')}
                style={styles.shortcutButton}
                activeOpacity={0.7}>
                <Text style={styles.shortcutText}>Feed</Text>
              </TouchableOpacity>
            </View>

            {/* Past Sessions */}
            <TouchableOpacity
              onPress={() => navigation.navigate('SessionHistory')}
              style={styles.pastSessionsButton}
              activeOpacity={0.7}>
              <Text style={styles.pastSessionsText}>Past Sessions</Text>
            </TouchableOpacity>

            {/* Product Suggestions — disabled for v1, see PRODUCT_SUGGESTIONS_DEFERRED. */}
            {/*
            <View style={styles.productSettings}>
              <View style={styles.productSettingRow}>
                <Text style={styles.productSettingLabel}>Show product suggestions</Text>
                <Switch
                  value={showProducts}
                  onValueChange={async (val) => {
                    setShowProducts(val);
                    await AsyncStorage.setItem('@livestylist_show_products', String(val));
                  }}
                  trackColor={{ false: COLORS.grayMid, true: COLORS.pinkLight }}
                  thumbColor={showProducts ? COLORS.pink : COLORS.grayLight}
                />
              </View>
              {showProducts && (
                <View style={styles.regionSelector}>
                  <Text style={styles.regionLabel}>Shopping region:</Text>
                  <View style={styles.regionOptions}>
                    <TouchableOpacity
                      style={[styles.regionOption, productRegion === 'eu' && styles.regionOptionActive]}
                      onPress={async () => {
                        setProductRegion('eu');
                        await AsyncStorage.setItem('@livestylist_product_region', 'eu');
                      }}>
                      <Text style={[styles.regionOptionText, productRegion === 'eu' && styles.regionOptionTextActive]}>EU</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.regionOption, productRegion === 'us' && styles.regionOptionActive]}
                      onPress={async () => {
                        setProductRegion('us');
                        await AsyncStorage.setItem('@livestylist_product_region', 'us');
                      }}>
                      <Text style={[styles.regionOptionText, productRegion === 'us' && styles.regionOptionTextActive]}>US</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
            */}

            {/* Tip */}
            <View style={styles.tip}>
              <Text style={styles.tipText}>
                Good lighting = better advice! Sit near a window for the best results.
              </Text>
            </View>

            {/* Upgrade Banner */}
            {!isPremium && (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.upgradeBanner}
                onPress={() => navigation.navigate('Paywall', { reason: 'manual' })}>
                <LinearGradient
                  colors={[COLORS.textDark, '#5A2D45']}
                  style={styles.upgradeGradient}>
                  <View>
                    <Text style={styles.upgradeTitle}>Go Premium</Text>
                    <Text style={styles.upgradeSub}>
                      Get{' '}
                      <Text style={[styles.upgradeSubAccent, { color: dailyAccentColor }]}>
                        daily
                      </Text>
                      {' '}styling tips
                    </Text>
                  </View>
                  <LinearGradient
                    colors={[COLORS.gold, COLORS.peach]}
                    style={styles.upgradePill}>
                    <Text style={styles.upgradeAction}>Upgrade</Text>
                  </LinearGradient>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </Animated.View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <View style={styles.footerLinks}>
          <Text
            style={styles.footerLink}
            onPress={() => Linking.openURL('https://livestylist.app/terms')}>
            Terms &amp; Conditions
          </Text>
          <Text style={styles.footerDot}>&middot;</Text>
          <Text
            style={styles.footerLink}
            onPress={() => Linking.openURL('https://livestylist.app/privacy')}>
            Privacy Policy
          </Text>
        </View>
        <Text style={styles.version}>v1.0 (build 1)</Text>
      </View>

      {profile && (
        <ProfileModal
          visible={profileModalVisible}
          onClose={() => setProfileModalVisible(false)}
          onSaved={() => {
            setProfileModalVisible(false);
            loadProfile();
          }}
          onReset={() => {
            setProfileModalVisible(false);
            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
          }}
          onShowAppIntro={handleShowHelpFromProfile}
          currentName={profile.name}
          currentStylistName={profile.stylist_name ?? ''}
          currentColor={profile.favorite_color}
          currentLanguage={profile.language ?? 'en'}
        />
      )}

      <HelpOverlay visible={helpVisible} onDismiss={handleHelpDismiss} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 56,
  },
  tierBadge: {
    backgroundColor: COLORS.white,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.pinkLight,
    shadowColor: COLORS.grayMid,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  tierBadgePremium: {
    borderColor: COLORS.gold,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMid,
  },
  tierTextPremium: { color: COLORS.white },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 50,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.pinkLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.grayLight,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  greeting: { marginBottom: 28 },
  greetingText: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.textDark,
    lineHeight: 35,
  },
  greetingSub: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMid,
    marginTop: 6,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: 22,
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '40',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.grayLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sessionsPill: {
    marginVertical: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  sessionsText: {
    fontSize: 13,
    fontWeight: '700',
  },
  upgradeBanner: {
    marginTop: 16,
    borderRadius: 50,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 4,
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 50,
  },
  upgradeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  upgradeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  upgradeSubAccent: {
    color: COLORS.gold,
    fontWeight: '800',
  },
  upgradePill: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 50,
  },
  upgradeAction: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  pastSessionsButton: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 50,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '40',
    alignItems: 'center',
    shadowColor: COLORS.grayLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 1,
  },
  pastSessionsText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.pink,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  shortcutButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 50,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '40',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.grayLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 1,
    flexDirection: 'row',
    gap: 6,
  },
  shortcutText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.pink,
  },
  shortcutBadge: {
    backgroundColor: COLORS.pink,
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  shortcutBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  productSettings: {
    marginTop: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '30',
    shadowColor: COLORS.grayLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 1,
  },
  productSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productSettingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMid,
  },
  regionSelector: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  regionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  regionOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  regionOption: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: COLORS.grayMid,
    backgroundColor: COLORS.white,
  },
  regionOptionActive: {
    borderColor: COLORS.pink,
    backgroundColor: COLORS.pinkSoft,
  },
  regionOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  regionOptionTextActive: {
    color: COLORS.pink,
  },
  tip: {
    marginTop: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '30',
    shadowColor: COLORS.grayLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 1,
  },
  tipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMid,
    lineHeight: 20,
  },
  consentNote: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 12,
    lineHeight: 16,
  },
  consentLink: {
    color: COLORS.pink,
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  footerLink: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMid,
    textDecorationLine: 'underline',
  },
  footerDot: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  version: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});
