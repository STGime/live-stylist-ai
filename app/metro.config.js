const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const config = {
  resolver: {
    assetExts: [...(defaultConfig.resolver?.assetExts || []), 'glb'],
  },
};

module.exports = mergeConfig(defaultConfig, config);
