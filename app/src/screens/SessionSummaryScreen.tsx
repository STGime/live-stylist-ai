import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import BubbleButton from '../components/BubbleButton';
import FloatingBubbles from '../components/FloatingBubbles';
import Confetti from '../components/Confetti';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionSummary'>;

const REASON_TEXT: Record<string, string> = {
  time: "Time's up!",
  manual: 'You ended it',
  error: 'Connection lost',
};

export default function SessionSummaryScreen({ route, navigation }: Props) {
  const { duration, reason, sessionsLeft } = route.params;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, delay: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, delay: 200, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const mins = Math.floor(duration / 60);
  const secs = duration % 60;

  return (
    <LinearGradient
      colors={[COLORS.cream, COLORS.pinkPale, COLORS.lavenderSoft]}
      locations={[0, 0.5, 1]}
      style={styles.container}>
      <Confetti />
      <FloatingBubbles count={16} />
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}>
        {/* Celebration icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.emoji}>🎉</Text>
        </View>

        <Text style={styles.title}>Great sesh!</Text>
        <Text style={styles.reason}>{REASON_TEXT[reason] || reason}</Text>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {mins}:{secs.toString().padStart(2, '0')}
            </Text>
            <Text style={styles.statLabel}>DURATION</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{sessionsLeft}</Text>
            <Text style={styles.statLabel}>LEFT TODAY</Text>
          </View>
        </View>

        <View style={styles.buttonArea}>
          <BubbleButton onPress={() => navigation.replace('Home')}>
            Back to Home
          </BubbleButton>
          {sessionsLeft <= 0 && (
            <View style={{ marginTop: 12 }}>
              <BubbleButton variant="dark" onPress={() => {}}>
                Go Premium — 5x sessions
              </BubbleButton>
            </View>
          )}
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: COLORS.pinkLight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  emoji: { fontSize: 38 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 32,
  },
  reason: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMid,
    marginTop: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 28,
    backgroundColor: COLORS.white,
    borderRadius: 50,
    overflow: 'hidden',
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '30',
  },
  statBox: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: 1,
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 2,
    backgroundColor: COLORS.pinkSoft,
  },
  buttonArea: {
    width: '100%',
    marginTop: 32,
  },
});
