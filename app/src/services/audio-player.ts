/**
 * PCM audio playback queue.
 * Receives base64-encoded 24kHz 16-bit mono PCM from Gemini and plays
 * it sequentially using a thin native Android AudioTrack module.
 */

import { NativeModules, Platform } from 'react-native';

const { PcmPlayer } = NativeModules;

/**
 * `true` when JS-side could find the iOS native module. If `false` on
 * iOS, calls below silently no-op and there will be no agent audio — the
 * UI shows a visible warning so we don't get stuck wondering whether
 * autolinking landed.
 */
export const isPcmPlayerAvailable: boolean = Platform.OS !== 'ios' || PcmPlayer != null;

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

  /**
   * iOS-only: forces the AVAudioSession output to the loudspeaker. Call
   * after `startMic` because the mic module calls `setCategory(.voiceChat)`
   * without `.defaultToSpeaker`, which silently re-routes to the earpiece.
   * No-op on Android (the JS-side optional-chain swallows it).
   */
  routeToSpeaker(): void {
    PcmPlayer?.routeToSpeaker?.();
  }

  stop(): void {
    PcmPlayer?.stop();
  }
}
