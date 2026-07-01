import FastTranslator from 'fast-mlkit-translate-text';
import { toMlkitLanguage } from '@/constants/mlkitLanguages';

// Per-language ML Kit pack management for the language picker: which packs are on device,
// and downloading one on demand. Packs are keyed by ML Kit's BCP-47 tag (e.g. "en", "vi",
// "tl"); several of our codes can share one tag (fil→tl, zh-tw→zh).

/** ML Kit tag for one of our language codes, or null if the language isn't supported. */
export function codeToTag(code: string): string | null {
  const name = toMlkitLanguage(code);
  if (!name) return null;
  return FastTranslator.tagFromLanguage(name) ?? null;
}

/** Tags of every language pack currently downloaded on the device. */
export async function getDownloadedPackTags(): Promise<string[]> {
  try {
    return (await FastTranslator.getDownloadedLanguageModels()) ?? [];
  } catch {
    return [];
  }
}

/** Download the pack for one of our language codes. Resolves true on success. */
export async function downloadLanguagePack(code: string): Promise<boolean> {
  const name = toMlkitLanguage(code);
  if (!name) return false;
  return FastTranslator.downloadLanguageModel(name);
}
