import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import type { AiState } from '../types';

interface Props {
  state: AiState;
}

const COLOR_MAP: Record<AiState, string> = {
  listening: COLORS.pink,
  thinking: COLORS.lavender,
  speaking: COLORS.magenta,
  analyzing: COLORS.mint,
  idle: COLORS.grayMid,
};

const LABEL_MAP: Record<AiState, string> = {
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
  analyzing: 'Analyzing...',
  idle: 'Connecting...',
};

function AnimatedBar({ index, color, active }: { index: number; color: string; active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            delay: index * 80,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    } else {
      anim.setValue(0);
    }
  }, [active, anim, index]);

  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 18],
  });

  return (
    <Animated.View
      style={{
        width: 4,
        height,
        borderRadius: 3,
        backgroundColor: color,
      }}
    />
  );
}

export default function AiOrb({ state }: Props) {
  const color = COLOR_MAP[state];
  const active = state !== 'idle';

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {[0, 1, 2, 3, 4].map(i => (
          <AnimatedBar key={i} index={i} color={color} active={active} />
        ))}
      </View>
      <Text style={styles.label}>{LABEL_MAP[state]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.2,
  },
});
