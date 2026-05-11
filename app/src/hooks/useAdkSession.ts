/**
 * Orchestration hook that ties the ADK backend WebSocket, mic capture,
 * camera snapshots, and audio playback together into a single interface
 * for the LiveSessionScreen.
 *
 * Replaces useGeminiSession — all AI processing now goes through the backend.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, PermissionsAndroid, AppState } from 'react-native';
import LiveAudioStream from 'react-native-live-audio-stream';
import RNFS from 'react-native-fs';
import type { Camera } from 'react-native-vision-camera';
import { AdkSessionClient } from '../services/adk-client';
import type { AdkAiState, SessionEvent, PreviewImageData, ProductResult } from '../services/adk-client';
import { PcmAudioPlayer } from '../services/audio-player';
import { cropFrame } from '../services/frame-cropper';
import { computeRmsAmplitude } from '../utils/audio-amplitude';

interface UseAdkSessionConfig {
  wsUrl: string;
  muted: boolean;
  onSessionEvent?: (event: SessionEvent) => void;
}

// RMS over the user's mic above this triggers an immediate playback flush
// when the agent is speaking. Picked empirically: typical conversational
// speech RMS through VOICE_COMMUNICATION is 0.05–0.2; quiet ambient is < 0.02.
const USER_BARGE_IN_RMS_THRESHOLD = 0.05;

export type SubtitleDirection = 'input' | 'output';

interface UseAdkSessionResult {
  aiState: AdkAiState;
  cameraRef: React.RefObject<Camera | null>;
  isConnected: boolean;
  error: string | null;
  visionActive: string[];
  subtitleText: string;
  subtitleDirection: SubtitleDirection;
  previewImage: string | null;
  previewUrl: string | null;
  previewMimeType: string;
  previewPrompt: string;
  previewLoading: boolean;
  previewTrigger: 'agent' | 'client' | null;
  previewError: string | null;
  clearPreviewError: () => void;
  products: ProductResult[];
  amplitudeRef: React.RefObject<number>;
  dismissPreview: () => void;
  dismissProducts: () => void;
  deactivateCamera: () => void;
}

export function useAdkSession(config: UseAdkSessionConfig): UseAdkSessionResult {
  const { wsUrl, muted, onSessionEvent } = config;

  const [aiState, setAiState] = useState<AdkAiState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visionActive, setVisionActive] = useState<string[]>([]);
  const [subtitleText, setSubtitleText] = useState('');
  const [subtitleDirection, setSubtitleDirection] = useState<SubtitleDirection>('output');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState('image/jpeg');
  const [previewPrompt, setPreviewPrompt] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTrigger, setPreviewTrigger] = useState<'agent' | 'client' | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductResult[]>([]);

  const cameraRef = useRef<Camera | null>(null);
  const amplitudeRef = useRef(0);
  const cameraActiveRef = useRef(true);
  const clientRef = useRef<AdkSessionClient | null>(null);
  const playerRef = useRef<PcmAudioPlayer | null>(null);
  const aiStateRef = useRef<AdkAiState>('idle');
  const mutedRef = useRef(muted);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micStartedRef = useRef(false);
  const onSessionEventRef = useRef(onSessionEvent);

  // Keep refs in sync
  useEffect(() => {
    mutedRef.current = muted;
    // Notify backend of mute state
    if (clientRef.current?.isConnected) {
      if (muted) {
        clientRef.current.sendMute();
      } else {
        clientRef.current.sendUnmute();
      }
    }
  }, [muted]);

  useEffect(() => {
    onSessionEventRef.current = onSessionEvent;
  }, [onSessionEvent]);

  // Pause mic + drain playback when the app is backgrounded so we don't
  // stream wasted audio to a possibly-muted speaker or capture audio while
  // the user is in another app. Resume mic on foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (clientRef.current?.isConnected && !micStartedRef.current) {
          startMic();
        }
      } else {
        stopMic();
        playerRef.current?.flush();
        amplitudeRef.current = 0;
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const player = new PcmAudioPlayer();
    player.start();
    playerRef.current = player;

    const client = new AdkSessionClient({
      wsUrl,
      callbacks: {
        onReady: () => {
          setIsConnected(true);
          setAiState('listening');
          // Start mic immediately — Android AEC (audioSource: 7 VOICE_COMMUNICATION)
          // suppresses the agent's voice from the mic stream, so the user can
          // barge in even during the greeting.
          startMic();
          startCameraFrames();
        },
        onAudioChunk: (base64Pcm: string) => {
          amplitudeRef.current = computeRmsAmplitude(base64Pcm);
          player.enqueue(base64Pcm);
        },
        onStateChange: (state: AdkAiState) => {
          // Flush queued playback the moment the agent stops speaking
          // (turn-complete or interruption) so we don't keep playing
          // chunks after the user has the floor.
          if (aiStateRef.current === 'speaking' && state === 'listening') {
            playerRef.current?.flush();
            amplitudeRef.current = 0;
          }
          aiStateRef.current = state;
          setAiState(state);
          // Clear vision active when not analyzing
          if (state !== 'analyzing') {
            setVisionActive([]);
          }
        },
        onVisionActive: (agents: string[]) => {
          setVisionActive(agents);
        },
        onTranscript: (direction, text, finished) => {
          if (finished || !text) {
            // Clear after 4s of silence
            if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
            subtitleTimerRef.current = setTimeout(() => {
              setSubtitleText('');
            }, 4000);
            return;
          }
          setSubtitleText(text);
          setSubtitleDirection(direction);
          // Reset auto-clear timer
          if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
          subtitleTimerRef.current = setTimeout(() => {
            setSubtitleText('');
          }, 4000);
        },
        onPreviewGenerating: (prompt: string) => {
          setPreviewLoading(true);
          setPreviewPrompt(prompt);
          setPreviewImage(null);
        },
        onPreviewImage: (data: PreviewImageData) => {
          setPreviewLoading(false);
          setPreviewUrl(data.url ?? null);
          setPreviewImage(data.image ?? null);
          setPreviewMimeType(data.mimeType);
          setPreviewPrompt(data.prompt);
          setPreviewTrigger(data.trigger);
        },
        onPreviewError: ({ message }) => {
          setPreviewLoading(false);
          setPreviewImage(null);
          setPreviewError(message);
        },
        onProducts: (productList: ProductResult[]) => {
          setProducts(productList);
        },
        onSessionEvent: (event: SessionEvent) => {
          onSessionEventRef.current?.(event);
        },
        onError: (err: string) => {
          setError(err);
        },
        onClose: () => {
          setIsConnected(false);
        },
      },
    });

    clientRef.current = client;
    client.connect();

    return () => {
      stopMic();
      stopCameraFrames();
      client.disconnect();
      player.stop();
      clientRef.current = null;
      playerRef.current = null;
      if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startMic() {
    if (micStartedRef.current) return;

    // Request RECORD_AUDIO permission on Android
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('[AdkSession] Mic permission denied');
          return;
        }
      } catch (e) {
        console.warn('[AdkSession] Mic permission error:', e);
        return;
      }
    }

    try {
      LiveAudioStream.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: Platform.OS === 'android' ? 7 : undefined, // VOICE_COMMUNICATION — enables AEC
        wavFile: '',
      } as any);

      LiveAudioStream.on('data', (base64Chunk: string) => {
        // Always forward mic audio when not muted — Android AEC (audioSource: 7
        // VOICE_COMMUNICATION) suppresses the agent's voice from the mic stream
        // at the OS level, so the user can barge in over the agent and Gemini
        // will detect the overlap and emit `interrupted`.
        if (mutedRef.current || !clientRef.current?.isConnected) return;

        // Local VAD: if the user is clearly speaking while the agent is
        // speaking, drain the playback queue immediately so the cut-off
        // feels instant rather than waiting for Gemini's `interrupted`
        // signal (which adds 200-500ms RTT). The threshold is intentionally
        // generous to avoid false positives from background noise.
        if (aiStateRef.current === 'speaking') {
          const userRms = computeRmsAmplitude(base64Chunk);
          if (userRms > USER_BARGE_IN_RMS_THRESHOLD) {
            playerRef.current?.flush();
          }
        }

        clientRef.current.sendAudio(base64Chunk);
      });

      await new Promise<void>(resolve => setTimeout(resolve, 200));
      LiveAudioStream.start();
      micStartedRef.current = true;
      console.log('[AdkSession] Mic started');
    } catch (e) {
      console.warn('[AdkSession] Mic start error:', e);
    }
  }

  function stopMic() {
    if (micStartedRef.current) {
      LiveAudioStream.stop();
      micStartedRef.current = false;
    }
  }

  function startCameraFrames() {
    // Capture frames every 2 seconds and send crops to backend
    frameIntervalRef.current = setInterval(async () => {
      try {
        if (!cameraActiveRef.current) {
          return;
        }
        const camera = cameraRef.current;
        if (!camera) {
          console.log('[AdkSession] Frame skip: no camera ref');
          return;
        }
        if (!clientRef.current?.isConnected) {
          console.log('[AdkSession] Frame skip: not connected');
          return;
        }

        // Use takeSnapshot (captures from video preview — much smaller than takePhoto)
        // Requires video={true} on Camera component
        const photo = await camera.takeSnapshot({ quality: 30 });

        // Read file as base64 using RNFS (fetch/blob/FileReader is unreliable in RN)
        const base64Jpeg = await RNFS.readFile(photo.path, 'base64');

        console.log('[AdkSession] Frame captured, base64 length:', base64Jpeg.length);

        // Crop into 3 regions and send to backend
        const crops = cropFrame(base64Jpeg);
        clientRef.current?.sendFrame(crops.eyeCrop, crops.mouthCrop, crops.bodyCrop);
      } catch (e: any) {
        console.warn('[AdkSession] Frame capture error:', e?.message || e);
      }
    }, 2000);
  }

  function stopCameraFrames() {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }

  const dismissPreview = useCallback(() => {
    setPreviewImage(null);
    setPreviewUrl(null);
    setPreviewLoading(false);
    setPreviewPrompt('');
    setPreviewTrigger(null);
    setPreviewError(null);
  }, []);

  const clearPreviewError = useCallback(() => {
    setPreviewError(null);
  }, []);

  const dismissProducts = useCallback(() => {
    setProducts([]);
  }, []);

  const deactivateCamera = useCallback(() => {
    cameraActiveRef.current = false;
    stopCameraFrames();
  }, []);

  return {
    aiState,
    cameraRef,
    isConnected,
    error,
    visionActive,
    subtitleText,
    subtitleDirection,
    previewImage,
    previewUrl,
    previewMimeType,
    previewPrompt,
    previewLoading,
    previewTrigger,
    previewError,
    products,
    amplitudeRef,
    dismissPreview,
    clearPreviewError,
    dismissProducts,
    deactivateCamera,
  };
}
