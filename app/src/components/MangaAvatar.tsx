import React, { useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import Svg, {
  Ellipse,
  Circle,
  Path,
  G,
  Rect,
} from 'react-native-svg';
import { COLORS } from '../theme/colors';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface Props {
  speaking: boolean;
  size?: number;
}

export default function MangaAvatar({ speaking, size = 120 }: Props) {
  const bounce = useRef(new Animated.Value(0)).current;
  const headTilt = useRef(new Animated.Value(0)).current;
  const mouthOpen = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;

  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouthAnim = useRef<Animated.CompositeAnimation | null>(null);

  // --- Blinking ---
  const doBlink = useCallback(() => {
    Animated.sequence([
      Animated.timing(blinkAnim, { toValue: 0, duration: 80, useNativeDriver: false }),
      Animated.timing(blinkAnim, { toValue: 1, duration: 100, useNativeDriver: false }),
    ]).start(() => {
      const next = 2000 + Math.random() * 4000;
      blinkTimer.current = setTimeout(doBlink, next);
    });
  }, [blinkAnim]);

  useEffect(() => {
    const initial = 1000 + Math.random() * 2000;
    blinkTimer.current = setTimeout(doBlink, initial);
    return () => {
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
    };
  }, [doBlink]);

  // --- Bounce (body sway) ---
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

  // --- Head tilt ---
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(headTilt, { toValue: 2.5, duration: 2000, useNativeDriver: true }),
        Animated.timing(headTilt, { toValue: -2.5, duration: 2500, useNativeDriver: true }),
        Animated.timing(headTilt, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [headTilt]);

  // --- Mouth animation while speaking ---
  useEffect(() => {
    if (mouthAnim.current) {
      mouthAnim.current.stop();
      mouthAnim.current = null;
    }

    if (speaking) {
      const animateMouth = () => {
        const target = 3 + Math.random() * 7;
        const dur = 100 + Math.random() * 200;
        const anim = Animated.sequence([
          Animated.timing(mouthOpen, { toValue: target, duration: dur, useNativeDriver: false }),
          Animated.timing(mouthOpen, { toValue: 1, duration: dur * 0.6, useNativeDriver: false }),
        ]);
        mouthAnim.current = anim;
        anim.start(({ finished }) => {
          if (finished) animateMouth();
        });
      };
      animateMouth();
    } else {
      Animated.timing(mouthOpen, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }

    return () => {
      if (mouthAnim.current) mouthAnim.current.stop();
    };
  }, [speaking, mouthOpen]);

  // --- Eye sparkle pulse ---
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleOpacity, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(sparkleOpacity, { toValue: 0.3, duration: 1200, useNativeDriver: false }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [sparkleOpacity]);

  // Interpolations
  const eyeRy = blinkAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 12] });
  const sparkleR1 = blinkAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });
  const sparkleR2 = blinkAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 2] });
  const mouthRy = mouthOpen.interpolate({ inputRange: [0, 10], outputRange: [0, 10] });
  const mouthRx = mouthOpen.interpolate({ inputRange: [0, 10], outputRange: [6, 14] });

  const headRotate = headTilt.interpolate({
    inputRange: [-3, 3],
    outputRange: ['-3deg', '3deg'],
  });

  return (
    <Animated.View style={{ transform: [{ translateY: bounce }, { rotate: headRotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {/* Hair back */}
        <Ellipse cx={100} cy={85} rx={72} ry={75} fill="#3D1F33" />
        <Ellipse cx={100} cy={90} rx={68} ry={65} fill="#5A2D45" />
        {/* Face */}
        <Ellipse cx={100} cy={100} rx={55} ry={58} fill="#FFE0D0" />
        {/* Blush */}
        <Ellipse cx={68} cy={115} rx={12} ry={7} fill="#FFB3C1" opacity={0.6} />
        <Ellipse cx={132} cy={115} rx={12} ry={7} fill="#FFB3C1" opacity={0.6} />
        {/* Eyes — animated blink */}
        <AnimatedEllipse cx={78} cy={100} rx={10} ry={eyeRy} fill="#3D1F33" />
        <AnimatedEllipse cx={122} cy={100} rx={10} ry={eyeRy} fill="#3D1F33" />
        {/* Eye sparkles — fade with blink */}
        <AnimatedCircle cx={82} cy={96} r={sparkleR1} fill="white" />
        <AnimatedCircle cx={126} cy={96} r={sparkleR1} fill="white" />
        <AnimatedCircle cx={76} cy={102} r={sparkleR2} fill="white" />
        <AnimatedCircle cx={120} cy={102} r={sparkleR2} fill="white" />
        {/* Extra sparkle pulse */}
        <AnimatedCircle cx={84} cy={94} r={2} fill="white" opacity={sparkleOpacity} />
        <AnimatedCircle cx={128} cy={94} r={2} fill="white" opacity={sparkleOpacity} />
        {/* Eyebrows */}
        <Path d="M65 85 Q78 78 90 85" stroke="#3D1F33" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Path d="M110 85 Q122 78 135 85" stroke="#3D1F33" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {/* Mouth — animated open/close when speaking, smile when idle */}
        {speaking ? (
          <AnimatedEllipse cx={100} cy={128} rx={mouthRx} ry={mouthRy} fill={COLORS.pink} />
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
