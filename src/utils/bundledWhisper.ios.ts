import * as FileSystem from 'expo-file-system/legacy';
import { WHISPER_MODEL_FILENAME } from '@/constants/whisperModel';

// iOS: the model ships at the app-bundle root via the Xcode Copy Bundle Resources plugin
// (plugins/withWhisperModel.js). We read it straight from bundleDirectory — no download,
// no require() (which would double-bundle the 56 MB file).
export async function getBundledWhisperPath(): Promise<string> {
  const dir = FileSystem.bundleDirectory;
  if (!dir) throw new Error('iOS bundleDirectory is unavailable.');
  const uri = `${dir.replace(/\/$/, '')}/${WHISPER_MODEL_FILENAME}`;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error(
      `Bundled Whisper model not found at ${uri}. Run \`expo prebuild\` after adding the withWhisperModel plugin.`,
    );
  }
  return uri.replace(/^file:\/\//, '');
}
