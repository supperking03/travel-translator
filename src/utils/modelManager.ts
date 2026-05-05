import * as FileSystem from 'expo-file-system/legacy';
import {
  MODEL_DOWNLOAD_URL,
  MODEL_FILENAME,
  getModelDir,
  getModelPath,
} from '@/constants/model';

export async function ensureModelDir(): Promise<void> {
  const dir = getModelDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export async function isModelDownloaded(): Promise<boolean> {
  const path = getModelPath();
  const info = await FileSystem.getInfoAsync(path);
  return info.exists && info.isDirectory === false;
}

export async function getModelFileSizeMB(): Promise<number | null> {
  const path = getModelPath();
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  return Math.round((info as FileSystem.FileInfo & { size: number }).size / (1024 * 1024));
}

export async function deleteModel(): Promise<void> {
  const path = getModelPath();
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) {
    await FileSystem.deleteAsync(path);
  }
}

export function createModelDownload(
  onProgress: (progress: number, downloadedMB: number) => void
): FileSystem.DownloadResumable {
  const path = getModelPath();
  return FileSystem.createDownloadResumable(
    MODEL_DOWNLOAD_URL,
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

export { MODEL_FILENAME, getModelPath };
