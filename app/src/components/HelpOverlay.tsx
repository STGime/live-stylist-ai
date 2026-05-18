// First-launch tour. Four-card horizontal carousel explaining what
// LiveStylist actually does. Shown automatically on the first Home
// mount, dismissable, and re-openable from Profile.
//
// State (the "should I show this?" check) lives in HomeScreen — this
// component is pure presentation: receives `visible`, calls
// `onDismiss(dontShowAgain)` so the parent can decide what to persist.
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Dimensions,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { COLORS } from '../theme/colors';

const COMMUNITY_GUIDELINES_URL = 'https://livestylist.app/community-guidelines.html';

interface Props {
  visible: boolean;
  onDismiss: (dontShowAgain: boolean) => void;
}

interface Card {
  emoji: string;
  title: string;
  // Body lines render as a vertical stack — keep them short, the modal is
  // narrow on small phones.
  lines: string[];
}

const CARDS: Card[] = [
  {
    emoji: '✨',
    title: 'Meet LiveStylist',
    lines: [
      'Your AI stylist on call.',
      'Voice + camera, real-time advice on whatever you’re wearing.',
    ],
  },
  {
    emoji: '🎙',
    title: 'Style sessions',
    lines: [
      '5 minutes per session.',
      'Talk about your outfit. Ask “does this work for X?”',
      'Say “show me” — they’ll generate a preview look.',
      'They remember your style across sessions.',
    ],
  },
  {
    emoji: '👥',
    title: 'Friends & feed',
    lines: [
      'Share your magic ID — friends can follow your sessions.',
      'See what they’ve been wearing in the Feed.',
      'Get a notification when they finish a look.',
    ],
  },
  {
    emoji: '📚',
    title: 'And more',
    lines: [
      'Past sessions — every look saved with images and tips.',
      'Premium — more sessions per month + future features.',
      'Profile (top right) — change your name, stylist, language.',
    ],
  },
];

export default function HelpOverlay({ visible, onDismiss }: Props) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  // Default ON — most users want a one-time tour, not a recurring popup.
  const [dontShowAgain, setDontShowAgain] = useState(true);
  // Width of one carousel page. Set on layout; using Dimensions as a
  // sensible first-paint default so the cards aren't initially zero-width.
  const [pageWidth, setPageWidth] = useState(Dimensions.get('window').width - 64);

  const isLast = pageIndex === CARDS.length - 1;

  // Reset to card 0 every time the modal opens — the user expects a tour
  // to start at the start, even if they got to card 3 and dismissed last time.
  React.useEffect(() => {
    if (visible) {
      setPageIndex(0);
      setDontShowAgain(true);
      // Defer to ensure ScrollView has laid out before we scroll.
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: 0, animated: false }));
    }
  }, [visible]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / Math.max(pageWidth, 1));
    if (idx !== pageIndex) setPageIndex(idx);
  };

  const handleNext = () => {
    if (isLast) {
      onDismiss(dontShowAgain);
      return;
    }
    scrollRef.current?.scrollTo({ x: (pageIndex + 1) * pageWidth, animated: true });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onDismiss(dontShowAgain)}>
      {/* Backdrop — tap to dismiss with the current checkbox state. */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => onDismiss(dontShowAgain)}>
        {/* Inner touchable swallows the tap so cards aren't tap-throughs. */}
        <TouchableOpacity activeOpacity={1} style={styles.cardWrap} onPress={() => {}}>
          <View
            style={styles.card}
            onLayout={(e) => setPageWidth(e.nativeEvent.layout.width - 32)}>
            {/* Header row: skip on the right. Hide entirely on the last
                card so the corner above the Don't-show-again toggle
                isn't a hidden tap-to-dismiss target. */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }} />
              {!isLast ? (
                <TouchableOpacity
                  onPress={() => onDismiss(dontShowAgain)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              style={{ flexGrow: 0 }}>
              {CARDS.map((c, i) => (
                <View key={i} style={[styles.page, { width: pageWidth }]}>
                  <Text style={styles.emoji}>{c.emoji}</Text>
                  <Text style={styles.title} accessibilityRole="header">{c.title}</Text>
                  <View style={styles.lines}>
                    {c.lines.map((line, j) => (
                      <Text key={j} style={styles.line}>{line}</Text>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Dot indicators */}
            <View style={styles.dots}>
              {CARDS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === pageIndex ? styles.dotActive : null,
                  ]}
                />
              ))}
            </View>

            {/* Don't-show-again — last card only. Showing it earlier would
                tempt users to flip it before they've seen the content.
                Whole row is tappable, not just the Switch — matches the
                standard mobile expectation that the label is part of the
                hit target. */}
            {isLast ? (
              <>
                <TouchableOpacity
                  style={styles.dontShowRow}
                  onPress={() => setDontShowAgain((v) => !v)}
                  activeOpacity={0.8}>
                  <Switch
                    value={dontShowAgain}
                    onValueChange={setDontShowAgain}
                    trackColor={{ false: COLORS.pinkLight, true: COLORS.pink }}
                  />
                  <Text style={styles.dontShowLabel}>Don’t show this again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL(COMMUNITY_GUIDELINES_URL).catch(() => {})}
                  accessibilityRole="link">
                  <Text style={styles.guidelinesLink}>Community Guidelines</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
              <Text style={styles.nextText}>{isLast ? 'Got it!' : 'Next ›'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '40',
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  page: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 40,
    marginTop: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 12,
    textAlign: 'center',
  },
  lines: {
    gap: 8,
    paddingHorizontal: 4,
  },
  line: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMid,
    lineHeight: 20,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.pinkLight,
  },
  dotActive: {
    backgroundColor: COLORS.pink,
  },
  dontShowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  dontShowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMid,
  },
  guidelinesLink: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.pink,
    textAlign: 'center',
    marginBottom: 10,
    textDecorationLine: 'underline',
  },
  nextButton: {
    alignSelf: 'center',
    backgroundColor: COLORS.pink,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 50,
    marginTop: 4,
  },
  nextText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
});
