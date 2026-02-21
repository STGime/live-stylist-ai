import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import BubbleButton from '../components/BubbleButton';
import FloatingBubbles from '../components/FloatingBubbles';
import * as api from '../services/api';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [sessionsRemaining, setSessionsRemaining] = useState(0);
  const [totalSessions, setTotalSessions] = useState(1);
  const [isPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const profile = await api.getProfile();
      setName(profile.name);
      const limit = isPremium ? 5 : 100;
      setTotalSessions(limit);
      setSessionsRemaining(Math.max(0, limit - profile.sessions_used_today));
    } catch (err: any) {
      if (err.status === 404) {
        navigation.replace('Onboarding');
        return;
      }
      Alert.alert('Error', 'Could not load your profile');
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Hey there' : 'Good evening';

  const handleStartSession = async () => {
    setStarting(true);
    try {
      const session = await api.startSession();
      navigation.navigate('LiveSession', {
        sessionId: session.session_id,
        expiryTime: session.session_expiry_time,
        wsUrl: session.ws_url,
      });
    } catch (err: any) {
      if (err.code === 'session_limit_exceeded') {
        setSessionsRemaining(0);
        Alert.alert('No Sessions Left', 'You\'ve used all your sessions today. Come back tomorrow!');
      } else {
        Alert.alert('Error', err.message || 'Could not start session');
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
          onPress={() => {
            // TODO: open profile sheet
          }}
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
          <>
            {/* Greeting */}
            <View style={styles.greeting}>
              <Text style={styles.greetingText}>
                {greeting},{'\n'}{name}!
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

              {/* Sessions pill */}
              <View
                style={[
                  styles.sessionsPill,
                  {
                    backgroundColor:
                      sessionsRemaining > 0 ? COLORS.green + '12' : COLORS.gold + '15',
                    borderColor:
                      sessionsRemaining > 0 ? COLORS.green + '30' : COLORS.gold + '30',
                  },
                ]}>
                <Text
                  style={[
                    styles.sessionsText,
                    { color: sessionsRemaining > 0 ? COLORS.green : COLORS.gold },
                  ]}>
                  {sessionsRemaining > 0
                    ? `${sessionsRemaining} of ${totalSessions} session${sessionsRemaining !== 1 ? 's' : ''} left`
                    : 'All sessions used today'}
                </Text>
              </View>

              <BubbleButton
                onPress={handleStartSession}
                disabled={starting}>
                {starting ? 'Starting...' : 'Start Session!'}
              </BubbleButton>
            </View>

            {/* Tip */}
            <View style={styles.tip}>
              <Text style={styles.tipText}>
                Good lighting = better advice! Sit near a window for the best results.
              </Text>
            </View>

            {/* Upgrade Banner */}
            {!isPremium && (
              <TouchableOpacity activeOpacity={0.85} style={styles.upgradeBanner}>
                <LinearGradient
                  colors={[COLORS.textDark, '#5A2D45']}
                  style={styles.upgradeGradient}>
                  <View>
                    <Text style={styles.upgradeTitle}>Go Premium</Text>
                    <Text style={styles.upgradeSub}>5 sessions per day</Text>
                  </View>
                  <LinearGradient
                    colors={[COLORS.gold, COLORS.peach]}
                    style={styles.upgradePill}>
                    <Text style={styles.upgradeAction}>Upgrade</Text>
                  </LinearGradient>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}
      </Animated.View>

      {/* Version info */}
      <Text style={styles.version}>v1.0 (build 1)</Text>
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
  tip: {
    marginTop: 16,
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
  version: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    paddingBottom: 28,
  },
});
