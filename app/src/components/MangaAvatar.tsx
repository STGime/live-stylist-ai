import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, {
  Ellipse,
  Circle,
  Path,
  G,
} from 'react-native-svg';
import { COLORS } from '../theme/colors';

interface Props {
  speaking: boolean;
  size?: number;
}

export default function MangaAvatar({ speaking, size = 120 }: Props) {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = speaking
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(bounce, { toValue: -6, duration: 300, useNativeDriver: true }),
            Animated.timing(bounce, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
        )
      : Animated.loop(
          Animated.sequence([
            Animated.timing(bounce, { toValue: -3, duration: 1500, useNativeDriver: true }),
            Animated.timing(bounce, { toValue: 0, duration: 1500, useNativeDriver: true }),
          ]),
        );

    animation.start();
    return () => animation.stop();
  }, [speaking, bounce]);

  return (
    <Animated.View style={{ transform: [{ translateY: bounce }] }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {/* Hair back */}
        <Ellipse cx={100} cy={85} rx={72} ry={75} fill="#3D1F33" />
        <Ellipse cx={100} cy={90} rx={68} ry={65} fill="#5A2D45" />
        {/* Face */}
        <Ellipse cx={100} cy={100} rx={55} ry={58} fill="#FFE0D0" />
        {/* Blush */}
        <Ellipse cx={68} cy={115} rx={12} ry={7} fill="#FFB3C1" opacity={0.6} />
        <Ellipse cx={132} cy={115} rx={12} ry={7} fill="#FFB3C1" opacity={0.6} />
        {/* Eyes */}
        <Ellipse cx={78} cy={100} rx={10} ry={12} fill="#3D1F33" />
        <Ellipse cx={122} cy={100} rx={10} ry={12} fill="#3D1F33" />
        {/* Eye sparkles */}
        <Circle cx={82} cy={96} r={4} fill="white" />
        <Circle cx={126} cy={96} r={4} fill="white" />
        <Circle cx={76} cy={102} r={2} fill="white" />
        <Circle cx={120} cy={102} r={2} fill="white" />
        {/* Eyebrows */}
        <Path d="M65 85 Q78 78 90 85" stroke="#3D1F33" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Path d="M110 85 Q122 78 135 85" stroke="#3D1F33" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {/* Mouth */}
        {speaking ? (
          <Ellipse cx={100} cy={128} rx={12} ry={8} fill={COLORS.pink} />
        ) : (
          <Path d="M88 125 Q100 138 112 125" stroke={COLORS.pink} strokeWidth={3} fill="none" strokeLinecap="round" />
        )}
        {/* Hair bangs */}
        <Path d="M35 75 Q50 40 80 50 Q70 70 60 80 Z" fill="#3D1F33" />
        <Path d="M165 75 Q150 40 120 50 Q130 70 140 80 Z" fill="#3D1F33" />
        <Path d="M55 55 Q75 25 100 35 Q90 55 80 65 Z" fill="#4A2540" />
        <Path d="M145 55 Q125 25 100 35 Q110 55 120 65 Z" fill="#4A2540" />
        {/* Sparkle accessories */}
        <Circle cx={48} cy={90} r={4} fill={COLORS.pink} opacity={0.8} />
        <Circle cx={152} cy={90} r={3} fill={COLORS.lavender} opacity={0.7} />
        {/* Star hair clip */}
        <G transform="translate(145, 60) scale(0.5)">
          <Path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={COLORS.yellow} />
        </G>
      </Svg>
    </Animated.View>
  );
}
