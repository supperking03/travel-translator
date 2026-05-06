import { useCallback, useEffect, useRef } from 'react';
import { initWhisper, WhisperContext } from 'whisper.rn';
import { useStore } from '@/store/useStore';
import {
  isWhisperModelDownloaded,
  ensureWhisperModelDir,
  createWhisperModelDownload,
} from '@/utils/whisperModelManager';
import { getWhisperModelPath } from '@/constants/whisperModel';

let _whisperContext: WhisperContext | null = null;
let _loadingPromise: Promise<void> | null = null;

export function useWhisper() {
  const downloadRef = useRef<ReturnType<typeof createWhisperModelDownload> | null>(null);
  const realtimeRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const {
    whisperModelStatus,
    setWhisperModelStatus,
    setWhisperDownloadProgress,
    setWhisperModelError,
  } = useStore();

  const loadModel = useCallback(async () => {
    if (_loadingPromise) return _loadingPromise;

    _loadingPromise = (async () => {
      try {
        setWhisperModelStatus('loading');
        setWhisperModelError(null);
        _whisperContext = await initWhisper({ filePath: getWhisperModelPath() });
        setWhisperModelStatus('ready');
      } catch (err) {
        setWhisperModelError(err instanceof Error ? err.message : 'Failed to load Whisper');
        setWhisperModelStatus('error');
      } finally {
        _loadingPromise = null;
      }
    })();

    return _loadingPromise;
  }, [setWhisperModelStatus, setWhisperModelError]);

  const downloadAndLoad = useCallback(async () => {
    try {
      await ensureWhisperModelDir();
      setWhisperModelStatus('downloading');
      setWhisperDownloadProgress(0);
      setWhisperModelError(null);

      downloadRef.current = createWhisperModelDownload((progress, _mb) => {
        setWhisperDownloadProgress(progress);
      });

      const result = await downloadRef.current.downloadAsync();
      if (!result || result.status !== 200) {
        throw new Error(`Download failed with status ${result?.status}`);
      }

      await loadModel();
    } catch (err) {
      setWhisperModelError(err instanceof Error ? err.message : 'Download failed');
      setWhisperModelStatus('error');
    }
  }, [loadModel, setWhisperModelStatus, setWhisperDownloadProgress, setWhisperModelError]);

  const cancelDownload = useCallback(async () => {
    if (downloadRef.current) {
      await downloadRef.current.cancelAsync();
      downloadRef.current = null;
      setWhisperModelStatus('not_downloaded');
      setWhisperDownloadProgress(0);
    }
  }, [setWhisperModelStatus, setWhisperDownloadProgress]);

  useEffect(() => {
    if (!_whisperContext && !_loadingPromise && whisperModelStatus !== 'downloading') {
      isWhisperModelDownloaded().then((exists) => {
        if (exists) loadModel();
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startListening = useCallback(async (
    language: string,
    onPartial: (text: string) => void,
    onDone: (text: string) => void,
  ) => {
    if (!_whisperContext) throw new Error('Whisper not loaded');

    const { stop, subscribe } = await _whisperContext.transcribeRealtime({
      language,
      maxLen: 1,
      tokenTimestamps: false,
      realtimeAudioSec: 30,
      audioSessionOnStartIos: {
        category: 'PlayAndRecord',
        options: ['DefaultToSpeaker', 'AllowBluetooth'],
        mode: 'Default',
        active: true,
      },
      audioSessionOnStopIos: 'restore',
    });

    realtimeRef.current = { stop };

    subscribe(({ isCapturing, data, error }) => {
      if (error) {
        realtimeRef.current = null;
        onDone('');
        return;
      }
      const text = data?.result?.trim() ?? '';
      if (isCapturing) {
        onPartial(text);
      } else {
        realtimeRef.current = null;
        onDone(text);
      }
    });
  }, []);

  const stopListening = useCallback(async () => {
    if (realtimeRef.current) {
      await realtimeRef.current.stop();
      realtimeRef.current = null;
    }
  }, []);

  return {
    downloadAndLoad,
    cancelDownload,
    loadModel,
    startListening,
    stopListening,
    isReady: whisperModelStatus === 'ready',
    whisperModelStatus,
  };
}
