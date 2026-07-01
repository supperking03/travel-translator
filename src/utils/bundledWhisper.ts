import { Asset } from 'expo-asset';

// Android (and default): the model is bundled into the APK/AAB via Metro's asset pipeline
// (metro.config.js registers `.bin` as an asset). Asset.fromModule().downloadAsync()
// extracts it from the compressed bundle to a readable cache path.
//
// NOTE: iOS uses bundledWhisper.ios.ts instead, which does NOT require() the model — on iOS
// the file is shipped via the Xcode Copy Bundle Resources plugin (plugins/withWhisperModel.js),
// so require()-ing it here too would bundle the 56 MB file twice.
const WHISPER_ASSET = require('../../assets/whisper/ggml-base-q5_1.bin');

/** Absolute filesystem path to the bundled Whisper model (no file:// scheme). */
export async function getBundledWhisperPath(): Promise<string> {
  const asset = Asset.fromModule(WHISPER_ASSET);
  if (!asset.localUri) await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('Bundled Whisper model is missing from the native build.');
  return uri.replace(/^file:\/\//, '');
}
