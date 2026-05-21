const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Support GGUF model files as assets
config.resolver.assetExts.push('gguf', 'bin', 'safetensors');

// Polyfill Node.js built-ins required by whisper.rn → safe-buffer
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: path.resolve(__dirname, 'node_modules/buffer'),
};

module.exports = config;
