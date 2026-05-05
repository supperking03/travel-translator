import { useCallback, useEffect, useRef } from 'react';
import { initLlama, LlamaContext } from 'llama.rn';
import { useStore } from '@/store/useStore';
import {
  isModelDownloaded,
  ensureModelDir,
  createModelDownload,
  getModelPath,
} from '@/utils/modelManager';
import {
  LLAMA_CONTEXT_PARAMS,
  TRANSLATION_COMPLETION_PARAMS,
  SYSTEM_PROMPT,
  buildTranslationPrompt,
} from '@/constants/model';
import { getLanguageByCode } from '@/constants/languages';

// Module-level singleton so all useLlama() instances share the same context
let _llamaContext: LlamaContext | null = null;
let _loadingPromise: Promise<void> | null = null;

export function useLlama() {
  const downloadRef = useRef<ReturnType<typeof createModelDownload> | null>(null);

  const {
    modelStatus,
    setModelStatus,
    setDownloadProgress,
    setModelError,
  } = useStore();

  const loadModel = useCallback(async () => {
    // Deduplicate concurrent load calls
    if (_loadingPromise) return _loadingPromise;

    _loadingPromise = (async () => {
      try {
        setModelStatus('loading');
        setModelError(null);

        const modelPath = getModelPath();
        const context = await initLlama({
          model: modelPath,
          ...LLAMA_CONTEXT_PARAMS,
        });
        _llamaContext = context;
        setModelStatus('ready');
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        setModelError(raw || 'Failed to initialize model');
        setModelStatus('error');
      } finally {
        _loadingPromise = null;
      }
    })();

    return _loadingPromise;
  }, [setModelStatus, setModelError]);

  const downloadAndLoad = useCallback(async () => {
    try {
      await ensureModelDir();
      setModelStatus('downloading');
      setDownloadProgress(0);
      setModelError(null);

      downloadRef.current = createModelDownload((progress) => {
        setDownloadProgress(progress);
      });

      const result = await downloadRef.current.downloadAsync();
      if (!result || result.status !== 200) {
        throw new Error(`Download failed with status ${result?.status}`);
      }

      await loadModel();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      setModelError(message);
      setModelStatus('error');
    }
  }, [loadModel, setModelStatus, setDownloadProgress, setModelError]);

  const cancelDownload = useCallback(async () => {
    if (downloadRef.current) {
      await downloadRef.current.cancelAsync();
      downloadRef.current = null;
      setModelStatus('not_downloaded');
      setDownloadProgress(0);
    }
  }, [setModelStatus, setDownloadProgress]);

  const releaseModel = useCallback(async () => {
    if (_llamaContext) {
      await _llamaContext.release();
      _llamaContext = null;
      setModelStatus('not_downloaded');
    }
  }, [setModelStatus]);

  // On mount: load model if downloaded but context not yet initialized
  useEffect(() => {
    if (!_llamaContext && !_loadingPromise && modelStatus !== 'downloading') {
      isModelDownloaded().then((exists) => {
        if (exists) loadModel();
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const translate = useCallback(
    async (text: string, sourceLangCode: string, targetLangCode: string): Promise<string> => {
      if (!_llamaContext) throw new Error('Model not loaded');

      const sourceLang = getLanguageByCode(sourceLangCode);
      const targetLang = getLanguageByCode(targetLangCode);

      if (!targetLang) throw new Error(`Unknown target language: ${targetLangCode}`);

      const sourceIsChineseFamily = sourceLang?.isChinese ?? false;

      const userMessage = buildTranslationPrompt(
        text,
        targetLang.promptName,
        sourceIsChineseFamily
      );

      const result = await _llamaContext.completion({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        ...TRANSLATION_COMPLETION_PARAMS,
      });

      // Strip any <think>...</think> block if model ignores /no_think
      const cleaned = result.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      return cleaned;
    },
    []
  );

  return {
    translate,
    downloadAndLoad,
    cancelDownload,
    releaseModel,
    isReady: modelStatus === 'ready',
  };
}
