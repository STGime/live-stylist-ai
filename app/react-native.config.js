// Tell Expo's autolinking about our local PcmPlayer pod so it gets
// registered with RN's Bridgeless interop layer. Without this, the pod
// builds and links but `NativeModules.PcmPlayer` is undefined at runtime —
// New Arch + Bridgeless only auto-discovers modules from node_modules.
const path = require('path');

module.exports = {
  dependencies: {
    'pcm-player-local': {
      root: path.join(__dirname, 'ios/PcmPlayer'),
      platforms: {
        ios: {
          podspecPath: path.join(__dirname, 'ios/PcmPlayer/PcmPlayer.podspec'),
        },
        android: null,
      },
    },
  },
};
