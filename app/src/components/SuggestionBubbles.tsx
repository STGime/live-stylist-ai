/**
 * Playful floating suggestion bubbles — Bubble Bobble / Rainbow Islands style.
 * Bubbles pop in from edges outside the face oval, float gently, then fade out.
 * Uses candy-bright colors and bouncy animations.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// Face oval exclusion zone (must match AgentMaskOverlay)
const OVAL_CX = SW / 2;
const OVAL_CY = SH * 0.45;
const OVAL_RX = (SW * 0.65) / 2 + 24;
const OVAL_RY = (SW * 0.65 * 1.35) / 2 + 24;

// Bright candy palette
const BUBBLE_COLORS = [
  '#FF6B9D', '#FF4088', '#D4A5FF', '#B388FF',
  '#7DDDB5', '#FFB088', '#FFD966', '#FF8A80',
  '#64B5F6', '#FFB740', '#E8368F', '#55C98A',
  '#FF4D6A', '#A5D6FF', '#C7266A', '#FFA6C9',
];

const SUGGESTIONS = [
  "Does this lipstick suit me?",
  "How's my eyeshadow blend?",
  "What color would look good on me?",
  "Is my foundation the right shade?",
  "How should I do my brows?",
  "Does this hairstyle work?",
  "What earrings would match?",
  "Is my blush too much?",
  "Rate my eyeliner!",
  "What's my skin undertone?",
  "Try a bold lip color?",
  "Does this necklace go?",
  "How's my contour?",
  "Suggest a new look!",
  "Am I warm or cool toned?",
  "Would bangs suit me?",
  "How's my highlight?",
  "What eye shape do I have?",
  "Does this color pop?",
  "Any tips for my brows?",
  "Try a smokey eye?",
  "Is this too much blush?",
  "What lip shape do I have?",
  "Suggest an updo!",
  "How do I look today?",
  "What makeup style fits me?",
  "Do these glasses suit me?",
  "How's the color harmony?",
  "Try a cat eye?",
  "What's my face shape?",
  "Does red lip work on me?",
  "Should I go darker?",
  "How's my skin looking?",
  "Try a natural look?",
  "What about a headband?",
  "Does this scarf match?",
  "How's my bronzer?",
  "Suggest evening makeup!",
  "Would a pixie cut suit me?",
  "What hair color would work?",
  "Rate my accessories!",
  "Is my concealer blended?",
  "Try winged liner?",
  "How's my lip liner?",
  "Suggest a daytime look!",
  "Do these colors clash?",
  "What about a side part?",
  "How should I style this?",
  "Does glitter suit me?",
  "Try a berry lip!",
  "What season am I?",
  "Should I add more volume?",
  "How's my mascara?",
  "Suggest a quick fix!",
  "Does nude lip work?",
  "Try a messy bun?",
  "What about coral tones?",
  "How's my setting powder?",
  "Suggest a party look!",
  "Would layers look good?",
];

interface BubbleData {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  scale: Animated.Value;
  opacity: Animated.Value;
  translateY: Animated.Value;
  rotation: Animated.Value;
}

// Avatar exclusion zone (bottom-center circle, must match LiveSessionScreen avatarArea)
const AVATAR_SIZE = 220;
const AVATAR_BOTTOM = 120; // matches styles.avatarArea.bottom
const AVATAR_CX = SW / 2;
const AVATAR_CY = SH - AVATAR_BOTTOM - AVATAR_SIZE / 2;
const AVATAR_R = AVATAR_SIZE / 2 + 20; // padding

function isInsideOval(x: number, y: number, bw: number, bh: number): boolean {
  const points = [
    [x, y], [x + bw, y], [x, y + bh], [x + bw, y + bh], [x + bw / 2, y + bh / 2],
  ];
  for (const [cx, cy] of points) {
    // Face oval exclusion
    const dx = (cx - OVAL_CX) / OVAL_RX;
    const dy = (cy - OVAL_CY) / OVAL_RY;
    if (dx * dx + dy * dy < 1) return true;
    // Avatar circle exclusion
    const adx = cx - AVATAR_CX;
    const ady = cy - AVATAR_CY;
    if (adx * adx + ady * ady < AVATAR_R * AVATAR_R) return true;
  }
  return false;
}

function randomPosition(): { x: number; y: number } {
  for (let i = 0; i < 50; i++) {
    const x = 10 + Math.random() * (SW - 220);
    const y = 100 + Math.random() * (SH - 300);
    if (!isInsideOval(x, y, 210, 48)) {
      return { x, y };
    }
  }
  const corners = [
    { x: 10, y: 105 },
    { x: SW - 215, y: 105 },
    { x: 10, y: SH - 210 },
    { x: SW - 215, y: SH - 210 },
  ];
  return corners[Math.floor(Math.random() * corners.length)];
}

function Bubble({ bubble }: { bubble: BubbleData }) {
  const rotate = bubble.rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['-3deg', '3deg'],
  });

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          left: bubble.x,
          top: bubble.y,
          backgroundColor: bubble.color + '22',
          borderColor: bubble.color + '55',
          opacity: bubble.opacity,
          transform: [
            { scale: bubble.scale },
            { translateY: bubble.translateY },
            { rotate },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <Text style={[styles.bubbleText, { color: bubble.color }]} numberOfLines={2}>
        {bubble.text}
      </Text>
      <View style={[styles.shine, { backgroundColor: bubble.color + '40' }]} />
    </Animated.View>
  );
}

interface Props {
  active: boolean;
}

export default function SuggestionBubbles({ active }: Props) {
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const nextId = useRef(0);
  const usedIndices = useRef(new Set<number>());

  useEffect(() => {
    if (!active) {
      setBubbles([]);
      return;
    }

    function pickSuggestion(): number {
      if (usedIndices.current.size >= SUGGESTIONS.length - 5) {
        usedIndices.current.clear();
      }
      let idx: number;
      do {
        idx = Math.floor(Math.random() * SUGGESTIONS.length);
      } while (usedIndices.current.has(idx));
      usedIndices.current.add(idx);
      return idx;
    }

    function spawn() {
      const idx = pickSuggestion();
      const pos = randomPosition();
      const color = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
      const id = nextId.current++;

      const scale = new Animated.Value(0);
      const opacity = new Animated.Value(0);
      const translateY = new Animated.Value(12);
      const rotation = new Animated.Value(0);

      const bubble: BubbleData = {
        id, text: SUGGESTIONS[idx],
        x: pos.x, y: pos.y, color,
        scale, opacity, translateY, rotation,
      };

      setBubbles(prev => {
        const kept = prev.length >= 3 ? prev.slice(-2) : prev;
        return [...kept, bubble];
      });

      // Pop in
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();

      // Wobble
      Animated.loop(
        Animated.sequence([
          Animated.timing(rotation, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.timing(rotation, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ]),
      ).start();

      // Fade out after a while
      const fadeTimer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -18, duration: 500, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.85, duration: 500, useNativeDriver: true }),
        ]).start(() => {
          setBubbles(prev => prev.filter(b => b.id !== id));
        });
      }, 4500);

      return fadeTimer;
    }

    // Spawn first bubble soon
    const firstTimer = setTimeout(() => spawn(), 800);

    // Schedule recurring spawns with a fixed interval
    const interval = setInterval(() => {
      spawn();
    }, 4000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
      setBubbles([]);
    };
  }, [active]);

  if (bubbles.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {bubbles.map(b => (
        <Bubble key={b.id} bubble={b} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    elevation: 3,
  },
  bubble: {
    position: 'absolute',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 2,
    maxWidth: 210,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  shine: {
    position: 'absolute',
    top: 7,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
