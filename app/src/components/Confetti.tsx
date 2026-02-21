import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = ['#FF8FAB', '#C5A3FF', '#FFF3A3', '#A8E6CF', '#FFB88C', '#E040A0'];

interface ParticleConfig {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  isCircle: boolean;
  anim: Animated.Value;
}

export default function Confetti() {
  const particles = useRef<ParticleConfig[]>(
    Array.from({ length: 35 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 1200,
      duration: 2000 + Math.random() * 2000,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 5 + Math.random() * 7,
      isCircle: Math.random() > 0.5,
      anim: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    particles.forEach((p) => {
      Animated.timing(p.anim, {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        useNativeDriver: true,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => {
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, SCREEN_HEIGHT],
        });
        const rotate = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '720deg'],
        });
        const opacity = p.anim.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 1, 0],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: `${p.left}%`,
              top: -p.size,
              width: p.size,
              height: p.isCircle ? p.size : p.size * 1.6,
              borderRadius: p.isCircle ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateY }, { rotate }],
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
    zIndex: 10,
    overflow: 'hidden',
  },
});
