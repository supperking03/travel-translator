import * as FileSystem from 'expo-file-system/legacy';
import {
  WHISPER_MODEL_URL,
  getWhisperModelDir,
  getWhisperModelPath,
} from '@/constants/whisperModel';

export async function ensureWhisperModelDir(): Promise<void> {
  const dir = getWhisperModelDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export async function isWhisperModelDownloaded(): Promise<boolean> {
  const path = getWhisperModelPath();
  const info = await FileSystem.getInfoAsync(path);
  return info.exists && info.isDirectory === false;
}

export async function getWhisperModelSizeMB(): Promise<number | null> {
  const path = getWhisperModelPath();
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  return Math.round(
    (info as FileSystem.FileInfo & { size: number }).size / (1024 * 1024)
  );
}

export async function deleteWhisperModel(): Promise<void> {
  const path = getWhisperModelPath();
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) {
    await FileSystem.deleteAsync(path);
  }
}

export function createWhisperModelDownload(
  onProgress: (progress: number, downloadedMB: number) => void
): FileSystem.DownloadResumable {
  const path = getWhisperModelPath();
  return FileSystem.createDownloadResumable(
    WHISPER_MODEL_URL,
    path,
    {},
    (downloadProgress) => {
      const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
      if (totalBytesExpectedToWrite > 0) {
        const progress = totalBytesWritten / totalBytesExpectedToWrite;
        const downloadedMB = Math.round(totalBytesWritten / (1024 * 1024));
        onProgress(progress, downloadedMB);
      }
    }
  );
}
