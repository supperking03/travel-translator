import { useMlkitTranslate } from '@/hooks/useMlkitTranslate';

/**
 * Single entry point the translate screens use for translation. The app runs entirely on
 * Google ML Kit on-device NMT (per-language ~30 MB packs); the old 1.14 GB llama engine
 * has been removed. Exposes the { translate, isReady } shape the screens consume.
 */
export function useTranslator() {
  return useMlkitTranslate();
}
