/**
 * Frame cropper — takes a full camera snapshot and produces 3 proportional crops
 * for the eye, mouth, and body vision agents.
 *
 * Crop regions are defined relative to the face guide oval position.
 * These constants are shared with AgentMaskOverlay so crop regions match
 * the visible masks exactly.
 */

import { Image } from 'react-native';

// Face guide oval position (matches LiveSessionScreen layout)
// All values as fractions of screen dimensions
export const FACE_GUIDE = {
  // Center of the face guide oval (fraction of screen width/height)
  centerX: 0.5,
  centerY: 0.22,
  // Oval radius as fraction of screen dimensions
  radiusX: 0.24, // ~180px on 375px wide screen
  radiusY: 0.14, // ~230px on 812px tall screen (accounting for top: 12%)
};

// Crop regions relative to the full frame
// These define the bounding boxes for each agent's crop
export const CROP_REGIONS = {
  eye: {
    // Upper portion of face guide: eyes + brows
    x: 0.25,       // left offset
    y: 0.10,       // top offset
    width: 0.50,   // crop width
    height: 0.14,  // crop height
  },
  mouth: {
    // Lower portion of face guide: lips + chin
    x: 0.30,
    y: 0.24,
    width: 0.40,
    height: 0.10,
  },
  body: {
    // Full face + upper body
    x: 0.10,
    y: 0.05,
    width: 0.80,
    height: 0.55,
  },
};

export interface FrameCrops {
  eyeCrop: string;
  mouthCrop: string;
  bodyCrop: string;
}

/**
 * Crop a full camera frame into 3 region crops.
 *
 * Since React Native doesn't have a built-in image cropping API,
 * we send the full frame as the body crop and use proportional
 * sub-regions for eye/mouth. The actual cropping happens by
 * resizing the snapshot with appropriate quality settings.
 *
 * For MVP: We send the same full frame for all 3 crops and let
 * the vision agents focus on their respective regions via their
 * system prompts. This avoids needing a native image processing
 * library while still getting scoped analysis.
 *
 * TODO: Add react-native-image-crop-picker or a Canvas-based
 * cropper for actual pixel-level cropping in a future iteration.
 */
export function cropFrame(fullFrameBase64: string): FrameCrops {
  // For MVP, send the full frame to all agents
  // Each agent's system prompt tells it which region to focus on
  return {
    eyeCrop: fullFrameBase64,
    mouthCrop: fullFrameBase64,
    bodyCrop: fullFrameBase64,
  };
}
