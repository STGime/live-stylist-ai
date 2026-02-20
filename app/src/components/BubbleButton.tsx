import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '../theme/colors';

type Variant = 'primary' | 'secondary' | 'dark' | 'ghost';

interface Props {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
}

const GRADIENTS: Record<Variant, [string, string]> = {
  primary: [COLORS.pink, COLORS.magenta],
  secondary: [COLORS.lavender, COLORS.lilac],
  dark: [COLORS.charcoal, '#4A2540'],
  ghost: [COLORS.white, COLORS.white],
};

const SHADOW_COLORS: Record<Variant, string> = {
  primary: COLORS.berry,
  secondary: '#8855CC',
  dark: '#1A0A14',
  ghost: COLORS.grayMid,
};

export default function BubbleButton({
  children,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
}: Props) {
  const textColor = variant === 'ghost' ? COLORS.textMid : COLORS.white;
  const shadowColor = disabled ? COLORS.grayMid : SHADOW_COLORS[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        styles.wrapper,
        { shadowColor },
        style,
      ]}>
      <LinearGradient
        colors={disabled ? [COLORS.grayLight, COLORS.grayLight] : GRADIENTS[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        <Text
          style={[
            styles.text,
            { color: disabled ? COLORS.textMuted : textColor },
          ]}>
          {children}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 50,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 50,
    alignItems: 'center',
  },
  text: {
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
