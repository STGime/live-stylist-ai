/**
 * PcmPlayer — iOS counterpart to the Android PcmPlayerModule.
 *
 * Plays sequential 24 kHz / 16-bit / mono PCM chunks streamed from the
 * coordinator agent (Gemini Live). Mirrors the Android module's API:
 *   start()  — open the audio session and start the player node
 *   enqueue(base64)  — schedule the decoded chunk for playback
 *   flush()  — drop any chunks still queued (e.g. on user barge-in)
 *   stop()  — tear everything down
 *
 * Uses AVAudioEngine + AVAudioPlayerNode so we can keep appending PCM
 * buffers without restarting playback between chunks.
 */
import AVFoundation
import Foundation
import UIKit

@objc(PcmPlayer)
final class PcmPlayer: NSObject {

  private static let sampleRate: Double = 24_000

  private let engine = AVAudioEngine()
  private let playerNode = AVAudioPlayerNode()
  private var format: AVAudioFormat?
  private var isStarted = false
  private var enqueueCount = 0
  private let workQueue = DispatchQueue(label: "app.livestylist.pcmplayer", qos: .userInitiated)

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(start)
  func start() {
    workQueue.async { [weak self] in
      guard let self = self, !self.isStarted else { return }

      NSLog("[PcmPlayer] start() called")

      // Defensive: disable proximity monitoring so the OS doesn't auto-route
      // playback to the earpiece when the user holds the phone to their face.
      DispatchQueue.main.async {
        UIDevice.current.isProximityMonitoringEnabled = false
      }

      // Audio session — share with the mic (which uses .playAndRecord).
      // Device logs from a previous build proved both `.voiceChat` AND
      // `.videoChat` keep the system's volume bus as "PhoneCall" — the
      // user's side-volume buttons control media volume, so playback was
      // routed to the loudspeaker correctly but was effectively muted on
      // a different volume bus. `.default` mode puts playback back on the
      // Audio/Video bus. Hardware AEC is lost — but we never had it,
      // because react-native-live-audio-stream uses AudioQueue (not
      // AVAudioEngine input node) for mic capture, and only the latter
      // wires into iOS's voice-processing pipeline.
      let session = AVAudioSession.sharedInstance()
      do {
        try session.setCategory(.playAndRecord,
                                mode: .default,
                                options: [.defaultToSpeaker, .allowBluetooth, .allowAirPlay])
        // Ask iOS to run hardware at 24kHz to avoid AVAudioEngine resample
        // surprises. Falls back to nearest supported rate.
        try session.setPreferredSampleRate(PcmPlayer.sampleRate)
        try session.setActive(true, options: [])
        try session.overrideOutputAudioPort(.speaker)
        NSLog("[PcmPlayer] session OK: hwRate=\(session.sampleRate) outputs=\(session.currentRoute.outputs.map { $0.portType.rawValue })")
      } catch {
        NSLog("[PcmPlayer] AVAudioSession setup failed: \(error)")
      }

      // Re-apply speaker override whenever the audio route changes (e.g. the
      // mic module reconfigures the session a few hundred ms after we start).
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(self.handleRouteChange(_:)),
        name: AVAudioSession.routeChangeNotification,
        object: session)

      // AVAudioPlayerNode's output bus only accepts float32/float64 — using
      // pcmFormatInt16 here throws "format.sampleRate == hwFormat.sampleRate"
      // from AUInterfaceBaseV3::SetFormat and crashes the dispatch queue.
      // We accept int16 PCM from the agent and convert to float32 on enqueue.
      guard let fmt = AVAudioFormat(commonFormat: .pcmFormatFloat32,
                                    sampleRate: PcmPlayer.sampleRate,
                                    channels: 1,
                                    interleaved: false) else {
        NSLog("[PcmPlayer] failed to create AVAudioFormat")
        return
      }
      self.format = fmt

      self.engine.attach(self.playerNode)
      self.engine.connect(self.playerNode, to: self.engine.mainMixerNode, format: fmt)

      do {
        try self.engine.start()
        self.playerNode.play()
        self.isStarted = true
        let outFmt = self.engine.outputNode.outputFormat(forBus: 0)
        NSLog("[PcmPlayer] engine started: running=\(self.engine.isRunning) outputFormat=\(outFmt) playerNode.isPlaying=\(self.playerNode.isPlaying)")
      } catch {
        NSLog("[PcmPlayer] engine start failed: \(error)")
      }
    }
  }

  @objc(enqueue:)
  func enqueue(_ base64: String) {
    workQueue.async { [weak self] in
      guard let self = self else { return }
      if !self.isStarted {
        NSLog("[PcmPlayer] enqueue dropped: not started")
        return
      }
      guard let fmt = self.format,
            let data = Data(base64Encoded: base64),
            data.count >= 2 else {
        NSLog("[PcmPlayer] enqueue dropped: bad data")
        return
      }

      let frameCount = UInt32(data.count / 2) // 16-bit samples
      guard let buffer = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: frameCount) else {
        NSLog("[PcmPlayer] enqueue dropped: buffer alloc failed")
        return
      }
      buffer.frameLength = frameCount

      // Convert int16 PCM samples → normalized float32 in [-1.0, 1.0].
      // AVAudioPlayerNode only accepts float32/float64 buffers.
      data.withUnsafeBytes { (rawBuffer: UnsafeRawBufferPointer) in
        guard let int16Ptr = rawBuffer.baseAddress?.assumingMemoryBound(to: Int16.self),
              let dst = buffer.floatChannelData?[0] else { return }
        let scale: Float = 1.0 / 32768.0
        for i in 0..<Int(frameCount) {
          dst[i] = Float(int16Ptr[i]) * scale
        }
      }

      self.playerNode.scheduleBuffer(buffer, completionHandler: nil)
      self.enqueueCount += 1
      // Log every 50 buffers so we can confirm continuous playback without
      // spamming the console.
      if self.enqueueCount % 50 == 1 {
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs.map { $0.portType.rawValue }
        NSLog("[PcmPlayer] enqueued \(self.enqueueCount) buffers; engine.running=\(self.engine.isRunning) playerNode.playing=\(self.playerNode.isPlaying) outputs=\(outputs)")
      }
    }
  }

  @objc(flush)
  func flush() {
    workQueue.async { [weak self] in
      guard let self = self, self.isStarted else { return }
      // Drop everything queued and restart so future enqueues play immediately.
      self.playerNode.stop()
      self.playerNode.play()
    }
  }

  @objc(routeToSpeaker)
  func routeToSpeaker() {
    workQueue.async {
      let session = AVAudioSession.sharedInstance()
      do {
        // Re-apply the FULL preferred config — the mic library calls
        // setCategory(.playAndRecord, mode: .voiceChat, ...) on start
        // *after* our PcmPlayer.start(), which puts playback on the
        // PhoneCall volume bus (audio plays but is inaudible at any
        // media-volume setting). Reset category+mode+options to .default
        // so playback lives on the Audio/Video media-volume bus.
        try session.setCategory(.playAndRecord,
                                mode: .default,
                                options: [.defaultToSpeaker, .allowBluetooth, .allowAirPlay])
        try session.setActive(true, options: [])
        try session.overrideOutputAudioPort(.speaker)
        let outputs = session.currentRoute.outputs.map { $0.portType.rawValue }
        NSLog("[PcmPlayer] routeToSpeaker applied; mode=\(session.mode.rawValue) outputs=\(outputs)")
      } catch {
        NSLog("[PcmPlayer] overrideOutputAudioPort(.speaker) failed: \(error)")
      }
    }
  }

  @objc private func handleRouteChange(_ notification: Notification) {
    // Re-assert speaker output whenever the route changes (e.g. the mic
    // module reconfigures the audio session). Skips:
    //  - external audio routes (the user *wants* the headphones)
    //  - notifications that we triggered ourselves via overrideOutputAudioPort
    //    (otherwise calling override fires another notification → infinite
    //     loop of overrides).
    guard
      let raw = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
      let reason = AVAudioSession.RouteChangeReason(rawValue: raw)
    else { return }

    if reason == .override {
      return
    }

    workQueue.async {
      let session = AVAudioSession.sharedInstance()
      let usingExternal = session.currentRoute.outputs.contains { output in
        output.portType == .bluetoothA2DP ||
        output.portType == .bluetoothHFP ||
        output.portType == .bluetoothLE ||
        output.portType == .headphones ||
        output.portType == .airPlay
      }
      if usingExternal {
        NSLog("[PcmPlayer] route change (reason=\(reason.rawValue)) — external audio device present, skipping override")
        return
      }
      do {
        try session.overrideOutputAudioPort(.speaker)
        let outputs = session.currentRoute.outputs.map { $0.portType.rawValue }
        NSLog("[PcmPlayer] route change (reason=\(reason.rawValue)) — re-applied speaker; outputs=\(outputs)")
      } catch {
        NSLog("[PcmPlayer] route change — override failed: \(error)")
      }
    }
  }

  @objc(stop)
  func stop() {
    workQueue.async { [weak self] in
      guard let self = self else { return }
      NotificationCenter.default.removeObserver(self, name: AVAudioSession.routeChangeNotification, object: nil)
      self.playerNode.stop()
      self.engine.stop()
      self.engine.disconnectNodeOutput(self.playerNode)
      self.engine.detach(self.playerNode)
      self.isStarted = false
      self.enqueueCount = 0
      NSLog("[PcmPlayer] stopped")
    }
  }

  // NativeEventEmitter compat (defensive — we don't currently emit events,
  // but adding these prevents a warning if a consumer ever wraps the module).
  @objc(addListener:) func addListener(_ eventName: String) {}
  @objc(removeListeners:) func removeListeners(_ count: Double) {}
}
