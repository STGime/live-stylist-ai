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

@objc(PcmPlayer)
final class PcmPlayer: NSObject {

  private static let sampleRate: Double = 24_000

  private let engine = AVAudioEngine()
  private let playerNode = AVAudioPlayerNode()
  private var format: AVAudioFormat?
  private var isStarted = false
  private let workQueue = DispatchQueue(label: "app.livestylist.pcmplayer", qos: .userInitiated)

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(start)
  func start() {
    workQueue.async { [weak self] in
      guard let self = self, !self.isStarted else { return }

      // Audio session — share with the mic (which uses .playAndRecord/.voiceChat).
      let session = AVAudioSession.sharedInstance()
      do {
        try session.setCategory(.playAndRecord,
                                mode: .voiceChat,
                                options: [.defaultToSpeaker, .allowBluetooth, .allowAirPlay])
        try session.setActive(true, options: [])
        // .voiceChat defaults to the earpiece on iOS — force the speaker route
        // up-front. We also re-apply this in routeToSpeaker() after the mic
        // module starts, because mic init calls setCategory without
        // .defaultToSpeaker and re-routes to the earpiece.
        try session.overrideOutputAudioPort(.speaker)
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

      let fmt = AVAudioFormat(commonFormat: .pcmFormatInt16,
                              sampleRate: PcmPlayer.sampleRate,
                              channels: 1,
                              interleaved: true)
      self.format = fmt

      self.engine.attach(self.playerNode)
      self.engine.connect(self.playerNode, to: self.engine.mainMixerNode, format: fmt)

      do {
        try self.engine.start()
        self.playerNode.play()
        self.isStarted = true
      } catch {
        NSLog("[PcmPlayer] engine start failed: \(error)")
      }
    }
  }

  @objc(enqueue:)
  func enqueue(_ base64: String) {
    workQueue.async { [weak self] in
      guard let self = self,
            self.isStarted,
            let fmt = self.format,
            let data = Data(base64Encoded: base64),
            data.count >= 2 else { return }

      let frameCount = UInt32(data.count / 2) // 16-bit samples
      guard let buffer = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: frameCount) else { return }
      buffer.frameLength = frameCount

      // Copy raw PCM bytes into the buffer's int16 channel data.
      data.withUnsafeBytes { (rawBuffer: UnsafeRawBufferPointer) in
        guard let src = rawBuffer.baseAddress,
              let dst = buffer.int16ChannelData?[0] else { return }
        memcpy(dst, src, data.count)
      }

      self.playerNode.scheduleBuffer(buffer, completionHandler: nil)
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
      do {
        try AVAudioSession.sharedInstance().overrideOutputAudioPort(.speaker)
      } catch {
        NSLog("[PcmPlayer] overrideOutputAudioPort(.speaker) failed: \(error)")
      }
    }
  }

  @objc private func handleRouteChange(_ notification: Notification) {
    // Re-assert speaker output whenever the route changes (e.g. the mic
    // module reconfigures the audio session). Skips the override when the
    // user has a Bluetooth headset connected.
    workQueue.async {
      let session = AVAudioSession.sharedInstance()
      let usingExternal = session.currentRoute.outputs.contains { output in
        output.portType == .bluetoothA2DP ||
        output.portType == .bluetoothHFP ||
        output.portType == .bluetoothLE ||
        output.portType == .headphones ||
        output.portType == .airPlay
      }
      if usingExternal { return }
      try? session.overrideOutputAudioPort(.speaker)
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
    }
  }

  // NativeEventEmitter compat (defensive — we don't currently emit events,
  // but adding these prevents a warning if a consumer ever wraps the module).
  @objc(addListener:) func addListener(_ eventName: String) {}
  @objc(removeListeners:) func removeListeners(_ count: Double) {}
}
