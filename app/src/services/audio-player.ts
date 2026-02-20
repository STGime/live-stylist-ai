/**
 * PCM audio playback queue.
 * Receives base64-encoded 24kHz 16-bit mono PCM from Gemini and plays
 * it sequentially using a thin native Android AudioTrack module.
 */

import { NativeModules } from 'react-native';

const { PcmPlayer } = NativeModules;

export class PcmAudioPlayer {
  start(): void {
    PcmPlayer?.start();
  }

  enqueue(base64Pcm: string): void {
    PcmPlayer?.enqueue(base64Pcm);
  }

  flush(): void {
    PcmPlayer?.flush();
  }

  stop(): void {
    PcmPlayer?.stop();
  }
}
