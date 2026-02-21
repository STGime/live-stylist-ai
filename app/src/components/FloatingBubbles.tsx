import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const LIGHT_COLORS = [
  '#FF8FAB', '#FF6B8A', '#C5A3FF', '#A78BFA', '#FFB88C',
  '#F9A8D4', '#A8E6CF', '#6EE7B7', '#FFF3A3', '#FDE68A',
  '#93C5FD', '#7DD3FC', '#E879F9', '#C084FC',
];
const DARK_COLORS = ['#FF8FAB', '#C5A3FF', '#E040A0', '#F9A8D4', '#A78BFA', '#7DD3FC'];

interface BubbleConfig {
  size: number;
  left: number;
  delay: number;
  duration: number;
  opacity: number;
  color: string;
  anim: Animated.Value;
}

interface Props {
  count?: number;
  dark?: boolean;
}

export default function FloatingBubbles({ count = 12, dark = false }: Props) {
  const bubbles = useRef<BubbleConfig[]>(
    Array.from({ length: count }, () => {
      const colors = dark ? DARK_COLORS : LIGHT_COLORS;
      const opacityMin = dark ? 0.1 : 0.25;
      const opacityMax = dark ? 0.25 : 0.5;
      return {
        size: 12 + Math.random() * 40,
        left: Math.random() * 100,
        delay: Math.random() * 8000,
        duration: 6000 + Math.random() * 10000,
        opacity: opacityMin + Math.random() * (opacityMax - opacityMin),
        color: colors[Math.floor(Math.random() * colors.length)],
        anim: new Animated.Value(0),
      };
    }),
  ).current;

  useEffect(() => {
    bubbles.forEach((bubble) => {
      const animate = () => {
        bubble.anim.setValue(0);
        Animated.timing(bubble.anim, {
          toValue: 1,
          duration: bubble.duration,
          delay: bubble.delay,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            bubble.delay = 0;
            animate();
          }
        });
      };
      animate();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {bubbles.map((bubble, i) => {
        const translateY = bubble.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [SCREEN_HEIGHT + bubble.size, -bubble.size],
        });
        const scale = bubble.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.3],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: `${bubble.left}%`,
              width: bubble.size,
              height: bubble.size,
              borderRadius: bubble.size / 2,
              backgroundColor: bubble.color,
              opacity: bubble.opacity,
              transform: [{ translateY }, { scale }],
            }}
          />
        );
      })}
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
    zIndex: 0,
    overflow: 'hidden',
  },
});
