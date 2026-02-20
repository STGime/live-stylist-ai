/**
 * Orchestration hook that ties the Gemini Live WebSocket, mic capture,
 * camera snapshots, and audio playback together into a single interface
 * for the LiveSessionScreen.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import LiveAudioStream from 'react-native-live-audio-stream';
import type { Camera } from 'react-native-vision-camera';
import { GeminiLiveClient } from '../services/gemini-live';
import { PcmAudioPlayer } from '../services/audio-player';
import type { AiState } from '../types';

interface UseGeminiSessionConfig {
  ephemeralToken: string;
  systemPrompt: string;
  geminiWsUrl: string;
  geminiModel: string;
  muted: boolean;
}

interface UseGeminiSessionResult {
  aiState: AiState;
  cameraRef: React.RefObject<Camera | null>;
  isConnected: boolean;
  error: string | null;
  injectText: (text: string) => void;
}

export function useGeminiSession(
  config: UseGeminiSessionConfig,
): UseGeminiSessionResult {
  const { ephemeralToken, systemPrompt, geminiWsUrl, geminiModel, muted } =
    config;

  const [aiState, setAiState] = useState<AiState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<Camera | null>(null);
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const playerRef = useRef<PcmAudioPlayer | null>(null);
  const mutedRef = useRef(muted);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micStartedRef = useRef(false);

  // Keep muted ref in sync without restarting mic
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const injectText = useCallback((text: string) => {
    clientRef.current?.sendText(text);
  }, []);

  useEffect(() => {
    const player = new PcmAudioPlayer();
    player.start();
    playerRef.current = player;

    const client = new GeminiLiveClient({
      geminiWsUrl,
      ephemeralToken,
      geminiModel,
      systemPrompt,
      callbacks: {
        onReady: () => {
          setIsConnected(true);
          setAiState('listening');
          startMic();
          startCameraFrames();
        },
        onAudioChunk: (base64Pcm: string) => {
          setAiState('speaking');
          player.enqueue(base64Pcm);
        },
        onTurnComplete: () => {
          setAiState('listening');
        },
        onInterrupted: () => {
          player.flush();
          setAiState('listening');
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startMic() {
    if (micStartedRef.current) {
      return;
    }

    // Request RECORD_AUDIO permission on Android
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('[GeminiSession] Mic permission denied');
          return;
        }
      } catch (e) {
        console.warn('[GeminiSession] Mic permission error:', e);
        return;
      }
    }

    try {
      LiveAudioStream.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: Platform.OS === 'android' ? 6 : undefined,
        wavFile: '', // Required by types but empty string disables WAV file output
      } as any);

      LiveAudioStream.on('data', (base64Chunk: string) => {
        if (!mutedRef.current && clientRef.current) {
          clientRef.current.sendAudio(base64Chunk);
        }
      });

      // Small delay to let AudioRecord initialize
      await new Promise(resolve => setTimeout(resolve, 200));

      LiveAudioStream.start();
      micStartedRef.current = true;
      console.log('[GeminiSession] Mic started');
    } catch (e) {
      console.warn('[GeminiSession] Mic start error:', e);
    }
  }

  function stopMic() {
    if (micStartedRef.current) {
      LiveAudioStream.stop();
      micStartedRef.current = false;
    }
  }

  function startCameraFrames() {
    // Capture a JPEG frame at ~1fps and send to Gemini
    frameIntervalRef.current = setInterval(async () => {
      try {
        const camera = cameraRef.current;
        if (!camera || !clientRef.current?.isConnected) {
          return;
        }

        const photo = await camera.takeSnapshot({
          quality: 50,
        });

        // Read the snapshot file as base64
        const RNFS = require('react-native-vision-camera');
        // VisionCamera returns a path; we need base64 for Gemini
        // Use fetch to read the file and convert to base64
        const response = await fetch(`file://${photo.path}`);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            // Strip the data URL prefix to get raw base64
            const base64 = dataUrl.split(',')[1] || dataUrl;
            resolve(base64);
          };
        });
        reader.readAsDataURL(blob);
        const base64Jpeg = await base64Promise;

        clientRef.current?.sendVideo(base64Jpeg);
      } catch {
        // Frame capture can fail transiently — skip this frame
      }
    }, 1000);
  }

  function stopCameraFrames() {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }

  return {
    aiState,
    cameraRef,
    isConnected,
    error,
    injectText,
  };
}
