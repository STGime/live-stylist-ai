import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../theme/colors';

interface PreviewRequestButtonProps {
  onPress: () => void;
  disabled: boolean;
}

export default function PreviewRequestButton({
  onPress,
  disabled,
}: PreviewRequestButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (disabled) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ scale: pulseAnim }] },
        disabled && styles.wrapperDisabled,
      ]}
    >
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {/* Magic wand / sparkle icon */}
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z"
            fill={disabled ? 'rgba(255,255,255,0.3)' : COLORS.lavender}
            stroke={disabled ? 'rgba(255,255,255,0.2)' : COLORS.lavender}
            strokeWidth={0.5}
          />
        </Svg>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 22,
    bottom: 130,
    zIndex: 5,
  },
  wrapperDisabled: {
    opacity: 0.5,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: COLORS.lavender + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
