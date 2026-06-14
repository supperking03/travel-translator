import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
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
let _needsContextRefresh = false;

function isMissingNativeContextError(err: unknown) {
  return err instanceof Error && /context not found/i.test(err.message);
}

export function useWhisper() {
  const downloadRef = useRef<ReturnType<typeof createWhisperModelDownload> | null>(null);
  const realtimeRef = useRef<{ stop: () => Promise<void> } | null>(null);
  // Resolves when the native realtime capture has actually ended (the isCapturing:false
  // event), not just when stop() returns. stop() only *requests* an abort, so we must wait
  // for this before starting a new session — otherwise the next start throws "context is
  // already capturing" / "Session deactivation failed".
  const captureEndedRef = useRef<Promise<void> | null>(null);

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

  const stopListening = useCallback(async () => {
    const session = realtimeRef.current;
    if (!session) return;
    const ended = captureEndedRef.current;
    try {
      await session.stop();
    } catch {
      // stop() can throw while the audio session is mid-teardown — ignore and still wait
      // for the capture-end event below.
    }
    // Wait for the native capture to actually finish before returning, so the next
    // startListening() doesn't collide with a still-running job. Cap it so we never hang.
    if (ended) {
      await Promise.race([
        ended,
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);
    }
    realtimeRef.current = null;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Android/Kobiton can recreate the native module after backgrounding while JS
        // still holds the old WhisperContext id. Force the next start to re-init.
        _needsContextRefresh = true;
        realtimeRef.current = null;
        captureEndedRef.current = null;
      }
    });

    return () => subscription.remove();
  }, []);

  const ensureContext = useCallback(async () => {
    if (_needsContextRefresh) {
      _whisperContext = null;
      _needsContextRefresh = false;
    }

    if (!_whisperContext) {
      await loadModel();
    }

    if (!_whisperContext) {
      throw new Error('Whisper not loaded');
    }

    return _whisperContext;
  }, [loadModel]);

  const startListening = useCallback(async (
    language: string | undefined,
    onPartial: (text: string) => void,
    onDone: (text: string) => void,
  ) => {
    // Make sure any previous realtime job has fully ended first — starting a new capture
    // while the old one is still running throws "context is already capturing".
    await stopListening();

    let realtime: Awaited<ReturnType<WhisperContext['transcribeRealtime']>> | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const context = await ensureContext();
        realtime = await context.transcribeRealtime({
          ...(language ? { language } : {}),
          // maxLen: 0 = no per-segment char cap; emit the full chunk as one segment.
          // Previous value of 1 was forcing per-character segmentation and slowing partials.
          maxLen: 0,
          tokenTimestamps: false,
          // Session length matches whisper.cpp's 30s sweet spot — auto-restart handles longer use.
          realtimeAudioSec: 30,
          // Process audio in 5s slices so partials show up snappier instead of waiting on a long window.
          realtimeAudioSliceSec: 5,
          // Fire the first transcription after 0.5s of audio (default is 1s) for a faster first word.
          realtimeAudioMinSec: 0.5,
          audioSessionOnStartIos: {
            category: 'PlayAndRecord',
            options: ['DefaultToSpeaker', 'AllowBluetooth'],
            mode: 'Default',
            active: true,
          },
          // On stop, switch to Playback and keep the session ACTIVE rather than deactivating it.
          // Deactivating while the capture is still tearing down throws 560030580 ("Session
          // deactivation failed"); Playback also leaves TTS able to play back at full volume.
          audioSessionOnStopIos: {
            category: 'Playback',
            options: [],
            mode: 'Default',
          },
        });
        break;
      } catch (err) {
        if (attempt === 0 && isMissingNativeContextError(err)) {
          _whisperContext = null;
          _needsContextRefresh = false;
          continue;
        }
        throw err;
      }
    }

    if (!realtime) {
      throw new Error('Whisper not loaded');
    }

    realtimeRef.current = { stop: realtime.stop };

    let resolveEnded: (() => void) | null = null;
    captureEndedRef.current = new Promise<void>((resolve) => { resolveEnded = resolve; });

    realtime.subscribe(({
      isCapturing,
      data,
      error,
    }: {
      isCapturing?: boolean;
      data?: { result?: string };
      error?: unknown;
    }) => {
      if (error) {
        realtimeRef.current = null;
        resolveEnded?.();
        resolveEnded = null;
        onDone('');
        return;
      }
      const text = data?.result?.trim() ?? '';
      if (isCapturing) {
        onPartial(text);
      } else {
        realtimeRef.current = null;
        resolveEnded?.();
        resolveEnded = null;
        onDone(text);
      }
    });
  }, [ensureContext, stopListening]);

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
