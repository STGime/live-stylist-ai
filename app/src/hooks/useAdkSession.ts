/**
 * Orchestration hook that ties the ADK backend WebSocket, mic capture,
 * camera snapshots, and audio playback together into a single interface
 * for the LiveSessionScreen.
 *
 * Replaces useGeminiSession — all AI processing now goes through the backend.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import LiveAudioStream from 'react-native-live-audio-stream';
import RNFS from 'react-native-fs';
import type { Camera } from 'react-native-vision-camera';
import { AdkSessionClient } from '../services/adk-client';
import type { AdkAiState, SessionEvent, PreviewImageData } from '../services/adk-client';
import { PcmAudioPlayer } from '../services/audio-player';
import { cropFrame } from '../services/frame-cropper';
import { computeRmsAmplitude } from '../utils/audio-amplitude';

interface UseAdkSessionConfig {
  wsUrl: string;
  muted: boolean;
  onSessionEvent?: (event: SessionEvent) => void;
}

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
  previewMimeType: string;
  previewPrompt: string;
  previewLoading: boolean;
  previewTrigger: 'agent' | 'client' | null;
  amplitudeRef: React.RefObject<number>;
  requestPreview: (prompt: string, category?: string) => void;
  dismissPreview: () => void;
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
  const [previewMimeType, setPreviewMimeType] = useState('image/jpeg');
  const [previewPrompt, setPreviewPrompt] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTrigger, setPreviewTrigger] = useState<'agent' | 'client' | null>(null);

  const cameraRef = useRef<Camera | null>(null);
  const amplitudeRef = useRef(0);
  const clientRef = useRef<AdkSessionClient | null>(null);
  const playerRef = useRef<PcmAudioPlayer | null>(null);
  const aiStateRef = useRef<AdkAiState>('idle');
  const mutedRef = useRef(muted);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micStartedRef = useRef(false);
  const greetingDoneRef = useRef(false);
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
          // Don't start mic yet — wait until greeting finishes to avoid feedback loop
          startCameraFrames();
        },
        onAudioChunk: (base64Pcm: string) => {
          amplitudeRef.current = computeRmsAmplitude(base64Pcm);
          player.enqueue(base64Pcm);
        },
        onStateChange: (state: AdkAiState) => {
          // Flush audio when interrupted (speaking → listening)
          if (aiStateRef.current === 'speaking' && state === 'listening') {
            playerRef.current?.flush();
            amplitudeRef.current = 0;
            // Start mic after greeting finishes (first speaking → listening transition)
            if (!greetingDoneRef.current) {
              greetingDoneRef.current = true;
              startMic();
            }
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
          setPreviewImage(data.image);
          setPreviewMimeType(data.mimeType);
          setPreviewPrompt(data.prompt);
          setPreviewTrigger(data.trigger);
        },
        onPreviewError: () => {
          setPreviewLoading(false);
          setPreviewImage(null);
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
        if (!mutedRef.current && clientRef.current?.isConnected) {
          clientRef.current.sendAudio(base64Chunk);
        }
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

  const requestPreview = useCallback((prompt: string, category?: string) => {
    clientRef.current?.sendGeneratePreview(prompt, category);
  }, []);

  const dismissPreview = useCallback(() => {
    setPreviewImage(null);
    setPreviewLoading(false);
    setPreviewPrompt('');
    setPreviewTrigger(null);
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
    previewMimeType,
    previewPrompt,
    previewLoading,
    previewTrigger,
    amplitudeRef,
    requestPreview,
    dismissPreview,
  };
}
