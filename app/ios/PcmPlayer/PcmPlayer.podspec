Pod::Spec.new do |s|
  s.name           = "PcmPlayer"
  s.version        = "1.0.0"
  s.summary        = "LiveStylist iOS PCM audio playback (24kHz int16 mono via AVAudioEngine)."
  s.description    = "Streams base64 PCM chunks from the coordinator agent to the device speaker. Matches the Android PcmPlayerModule."
  s.author         = "LiveStylist"
  s.homepage       = "https://livestylist.app"
  s.license        = { :type => "MIT" }
  s.platform       = :ios, "13.0"
  s.source         = { :path => "." }
  s.source_files   = "*.{swift,m,h}"
  s.frameworks     = "AVFoundation", "Foundation"
  s.swift_versions = ["5.0"]
  s.dependency "React-Core"
end
