const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Support GGUF model files as assets
config.resolver.assetExts.push('gguf', 'bin', 'safetensors');

module.exports = config;
