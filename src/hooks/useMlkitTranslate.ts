import { useCallback } from 'react';
import { mlkitTranslate } from '@/utils/mlkitTranslate';

/**
 * ML Kit translation shaped to match the slice of useLlama() that the translate
 * screens consume: { translate, isReady }.
 *
 * Unlike llama there is no single global model to load, so the engine is always
 * "ready" — the per-language packs download lazily inside translate() on first use.
 * There is no streaming equivalent; translate() resolves with the full string.
 */
export function useMlkitTranslate() {
  const translate = useCallback(
    (text: string, sourceLang: string, targetLang: string) =>
      mlkitTranslate(text, sourceLang, targetLang),
    [],
  );

  return {
    translate,
    isReady: true as const,
  };
}
