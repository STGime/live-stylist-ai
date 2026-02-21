/**
 * SVG overlay on camera showing a visible face guide oval + 3 agent region masks.
 * Each agent mask pulses/glows when its agent is active.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Dimensions } from 'react-native';
import Svg, { Ellipse, Rect } from 'react-native-svg';
import { COLORS } from '../theme/colors';
import { CROP_REGIONS } from '../services/frame-cropper';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visionActive: string[];
}

function usePulse(active: boolean) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    } else {
      anim.stopAnimation();
      anim.setValue(0);
    }
  }, [active, anim]);

  return anim;
}

export default function AgentMaskOverlay({ visionActive }: Props) {
  const eyeActive = visionActive.includes('eye');
  const mouthActive = visionActive.includes('mouth');
  const bodyActive = visionActive.includes('body');

  const eyePulse = usePulse(eyeActive);
  const mouthPulse = usePulse(mouthActive);
  const bodyPulse = usePulse(bodyActive);

  // Face guide oval dimensions — large and vertically centered
  const faceGuideW = SCREEN_W * 0.65;
  const faceGuideH = faceGuideW * 1.35;
  const faceGuideCX = SCREEN_W / 2;
  const faceGuideCY = SCREEN_H * 0.45;

  // Eye region: pink dashed oval inside upper portion of face guide
  const eyeCX = faceGuideCX;
  const eyeCY = faceGuideCY - faceGuideH * 0.18;
  const eyeRX = faceGuideW * 0.42;
  const eyeRY = faceGuideH * 0.14;

  // Mouth region: lavender dashed rounded rect inside lower portion
  const mouthCX = faceGuideCX;
  const mouthCY = faceGuideCY + faceGuideH * 0.22;
  const mouthW = faceGuideW * 0.50;
  const mouthH = faceGuideH * 0.16;

  // Body region: mint dashed rounded rect encompassing shoulders below face guide
  const bodyCX = faceGuideCX;
  const bodyCY = faceGuideCY + faceGuideH / 2 + 40;
  const bodyW = faceGuideW * 1.4;
  const bodyH = 80;

  const eyeOpacity = eyePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const mouthOpacity = mouthPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const bodyOpacity = bodyPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={SCREEN_W}
      height={SCREEN_H}
      pointerEvents="none">
      {/* Face guide oval — visible dashed white */}
      <Ellipse
        cx={faceGuideCX}
        cy={faceGuideCY}
        rx={faceGuideW / 2}
        ry={faceGuideH / 2}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1.5}
        strokeDasharray="6,4"
      />

      {/* Eye region mask — pink */}
      <AnimatedEllipse
        cx={eyeCX}
        cy={eyeCY}
        rx={eyeRX}
        ry={eyeRY}
        fill="none"
        stroke={COLORS.pink}
        strokeWidth={eyeActive ? 2 : 1}
        strokeDasharray="4,3"
        opacity={eyeActive ? eyeOpacity : 0.15}
      />

      {/* Mouth region mask — lavender */}
      <AnimatedRect
        x={mouthCX - mouthW / 2}
        y={mouthCY - mouthH / 2}
        width={mouthW}
        height={mouthH}
        rx={12}
        ry={12}
        fill="none"
        stroke={COLORS.lavender}
        strokeWidth={mouthActive ? 2 : 1}
        strokeDasharray="4,3"
        opacity={mouthActive ? mouthOpacity : 0.15}
      />

      {/* Body region mask — mint */}
      <AnimatedRect
        x={bodyCX - bodyW / 2}
        y={bodyCY - bodyH / 2}
        width={bodyW}
        height={bodyH}
        rx={16}
        ry={16}
        fill="none"
        stroke={COLORS.mint}
        strokeWidth={bodyActive ? 2 : 1}
        strokeDasharray="4,3"
        opacity={bodyActive ? bodyOpacity : 0.15}
      />
    </Svg>
  );
}
