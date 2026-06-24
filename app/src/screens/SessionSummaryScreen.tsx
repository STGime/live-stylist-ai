import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import BubbleButton from '../components/BubbleButton';
import FloatingBubbles from '../components/FloatingBubbles';
import Confetti from '../components/Confetti';
import ReviewPromptSheet from '../components/ReviewPromptSheet';
import { shareSummary } from '../utils/shareSummary';
import * as api from '../services/api';
import {
  incrementSessionCount,
  shouldShowReviewPrompt,
  markReviewSatisfied,
  requestStoreReview,
} from '../services/review-prompt';
import type { RootStackParamList, SessionHistoryItem } from '../types';

// How long to wait after the summary finishes loading before showing the
// review prompt. Long enough that the user has had a beat to skim the
// summary + tips ("recap the results"), short enough that it doesn't feel
// disconnected from the session that just ended.
const REVIEW_PROMPT_DELAY_MS = 3000;

type Props = NativeStackScreenProps<RootStackParamList, 'SessionSummary'>;

const REASON_TEXT: Record<string, string> = {
  time: "Time's up!",
  manual: 'You ended it',
  error: 'Connection lost',
};

export default function SessionSummaryScreen({ route, navigation }: Props) {
  const { duration, reason, sessionsLeft, sessionId } = route.params;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  console.log('[SessionSummary] sessionId:', sessionId);

  const [summaryData, setSummaryData] = useState<SessionHistoryItem | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(!!sessionId);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

  // Review prompt: counter bumped once on mount, modal shown after the
  // summary settles + a short grace period so the user gets to recap
  // before being interrupted.
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [reviewVisible, setReviewVisible] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, delay: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, delay: 200, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // One-shot session counter increment. Each non-error Summary mount ==
  // one completed session. We deliberately skip `reason === 'error'`
  // sessions — asking for a review immediately after a failed session
  // is the worst possible moment, and we'd rather miss a bump than nag
  // a frustrated user. The every-2nd cadence still ticks on subsequent
  // successful sessions.
  useEffect(() => {
    if (reason === 'error') return;
    incrementSessionCount().then(setSessionCount).catch(() => {});
  }, [reason]);

  // Schedule the review prompt for a trigger-eligible session, after the
  // summary has settled (so the user actually gets to recap the result
  // before being interrupted). For sessions with no `sessionId`, fall
  // through after a fixed grace.
  useEffect(() => {
    if (sessionCount === null) return; // not yet counted
    if (sessionId && summaryLoading) return; // wait for summary

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const ok = await shouldShowReviewPrompt(sessionCount);
      if (cancelled || !ok) return;
      timer = setTimeout(() => {
        if (!cancelled) setReviewVisible(true);
      }, REVIEW_PROMPT_DELAY_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionCount, sessionId, summaryLoading]);

  const handleReviewYes = () => {
    setReviewVisible(false);
    markReviewSatisfied().catch(() => {});
    // Fire-and-forget — the OS-native prompt is itself silent past its
    // rate limit, and we've already recorded the user's intent so we
    // won't ask again on this device.
    requestStoreReview().catch(() => {});
  };

  const handleReviewNo = () => {
    setReviewVisible(false);
    // Don't flip `satisfied` — the every-2nd-session cadence will retry.
  };

  // Poll for session summary
  useEffect(() => {
    if (!sessionId) return;

    const poll = () => {
      attemptsRef.current++;
      console.log('[SessionSummary] Polling attempt', attemptsRef.current, 'for', sessionId);
      api.getSessionSummary(sessionId)
        .then(data => {
          console.log('[SessionSummary] Got summary:', data.summary?.substring(0, 50));
          setSummaryData(data);
          setSummaryLoading(false);
        })
        .catch((err) => {
          console.log('[SessionSummary] Poll failed:', err?.message || err);
          if (attemptsRef.current < 8) {
            pollRef.current = setTimeout(poll, 2000);
          } else {
            setSummaryLoading(false);
          }
        });
    };

    // Initial delay — summary generation takes a few seconds
    pollRef.current = setTimeout(poll, 3000);

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [sessionId]);

  const mins = Math.floor(duration / 60);
  const secs = duration % 60;

  return (
    <LinearGradient
      colors={[COLORS.cream, COLORS.pinkPale, COLORS.lavenderSoft]}
      locations={[0, 0.5, 1]}
      style={styles.container}>
      <Confetti />
      <FloatingBubbles count={16} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
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

        {/* AI Summary + Tips */}
        {sessionId && (
          <View style={styles.summarySection}>
            {summaryLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.pink} />
                <Text style={styles.loadingText}>Generating your style summary...</Text>
              </View>
            ) : summaryData ? (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Your Style Summary</Text>
                <Text style={styles.summaryText}>{summaryData.summary}</Text>

                {summaryData.tips && summaryData.tips.length > 0 && (
                  <View style={styles.tipsContainer}>
                    {summaryData.tips.map((tip, i) => (
                      <View key={i} style={styles.tipPill}>
                        <Text style={styles.tipIcon}>✨</Text>
                        <Text style={styles.tipText}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Products mentioned */}
                {summaryData.products && summaryData.products.length > 0 && (
                  <View style={styles.productsSection}>
                    <Text style={styles.productsSectionTitle}>Products Mentioned</Text>
                    {summaryData.products.map((product, i) => (
                      <TouchableOpacity
                        key={`${product.id}-${i}`}
                        style={styles.productRow}
                        activeOpacity={0.7}
                        onPress={() => product.affiliateUrl && Linking.openURL(product.affiliateUrl)}>
                        {product.imageUrl ? (
                          <Image source={{ uri: product.imageUrl }} style={styles.productThumb} />
                        ) : (
                          <View style={[styles.productThumb, styles.productThumbPlaceholder]} />
                        )}
                        <View style={styles.productInfo}>
                          {product.brand ? <Text style={styles.productBrand}>{product.brand}</Text> : null}
                          <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                          <Text style={styles.productPrice}>
                            {product.currency === 'USD' ? '$' : product.currency === 'GBP' ? '\u00A3' : '\u20AC'}{product.price}
                          </Text>
                        </View>
                        <Text style={styles.productShopLink}>Shop →</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => shareSummary(summaryData.summary, summaryData.tips)}
                  style={styles.shareButton}
                  activeOpacity={0.7}>
                  <Text style={styles.shareButtonText}>Share Summary ↗</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.fallbackText}>
                Summary will be available in your session history shortly.
              </Text>
            )}
          </View>
        )}

        <View style={styles.buttonArea}>
          <BubbleButton onPress={() => navigation.replace('Home')}>
            Back to Home
          </BubbleButton>
          {sessionsLeft <= 0 && (
            <View style={{ marginTop: 12 }}>
              <BubbleButton
                variant="dark"
                onPress={() => navigation.navigate('Paywall', { reason: 'trial_used' })}>
                Go Premium — 30 sessions/month
              </BubbleButton>
            </View>
          )}
        </View>
      </Animated.View>
      </ScrollView>

      <ReviewPromptSheet
        visible={reviewVisible}
        onYes={handleReviewYes}
        onNo={handleReviewNo}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
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
  summarySection: {
    width: '100%',
    marginTop: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMid,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '30',
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textDark,
    lineHeight: 19,
  },
  tipsContainer: {
    marginTop: 12,
    gap: 6,
  },
  tipPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.pinkPale,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tipIcon: {
    fontSize: 12,
    marginTop: 1,
  },
  tipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMid,
    flex: 1,
    lineHeight: 18,
  },
  shareButton: {
    marginTop: 14,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 50,
    backgroundColor: COLORS.pinkSoft,
  },
  shareButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.pink,
  },
  fallbackText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  productsSection: {
    marginTop: 14,
    gap: 6,
  },
  productsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.pinkPale,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 10,
  },
  productThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.grayLight,
  },
  productThumbPlaceholder: {
    backgroundColor: COLORS.grayMid,
  },
  productInfo: {
    flex: 1,
    gap: 1,
  },
  productBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.pink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  productShopLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.pink,
  },
  buttonArea: {
    width: '100%',
    marginTop: 24,
  },
});
