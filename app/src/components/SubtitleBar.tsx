import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../theme/colors';
import type { SubtitleDirection } from '../hooks/useAdkSession';

interface SubtitleBarProps {
  text: string;
  direction: SubtitleDirection;
}

export default function SubtitleBar({ text, direction }: SubtitleBarProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: text ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [text, opacity]);

  if (!text) return null;

  return (
    <Animated.View
      style={[styles.container, { opacity }]}
      pointerEvents="none">
      <Text
        style={[
          styles.text,
          { color: direction === 'input' ? COLORS.pinkLight : '#FFFFFF' },
        ]}
        numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 260,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    maxWidth: '85%',
    zIndex: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
