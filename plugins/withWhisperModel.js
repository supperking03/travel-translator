// Bundles the Whisper speech-to-text model into the iOS app binary so it ships with the
// app (no runtime download). Adds the .bin to the Xcode "Resources" group and the
// Copy Bundle Resources build phase, so at runtime it sits at the app bundle root and is
// reachable via expo-file-system's bundleDirectory.
//
// Android needs nothing here: Metro bundles the require()'d asset into the APK/AAB (see
// metro.config.js assetExts + src/utils/bundledWhisper.ts).
//
// Mirrors the approach used in the wattpad-audio project's withTtsModelResources plugin.
const { IOSConfig, createRunOncePlugin, withXcodeProject } = require('@expo/config-plugins');
const path = require('path');

const MODEL_FILES = ['assets/whisper/ggml-base-q5_1.bin'];

const withWhisperModel = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const platformRoot = cfg.modRequest.platformProjectRoot;

    IOSConfig.XcodeUtils.ensureGroupRecursively(project, 'Resources');

    for (const file of MODEL_FILES) {
      const absolutePath = path.resolve(cfg.modRequest.projectRoot, file);
      const resourcePath = path.relative(platformRoot, absolutePath);

      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: resourcePath,
        groupName: 'Resources',
        project,
        isBuildFile: true,
        verbose: true,
      });
    }

    return cfg;
  });

module.exports = createRunOncePlugin(withWhisperModel, 'withWhisperModel', '1.0.0');
