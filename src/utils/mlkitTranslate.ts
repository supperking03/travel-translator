import FastTranslator from 'fast-mlkit-translate-text';
import type { Languages } from 'fast-mlkit-translate-text';
import { useStore } from '@/store/useStore';
import { toMlkitLanguage } from '@/constants/mlkitLanguages';

export class MlkitUnsupportedLanguageError extends Error {
  constructor(public code: string) {
    super(`ML Kit has no offline model for "${code}"`);
    this.name = 'MlkitUnsupportedLanguageError';
  }
}

export class MlkitOfflineError extends Error {
  constructor(public pairLabel: string) {
    super(
      `The "${pairLabel}" language pack needs a one-time download (~30 MB). ` +
      `Connect to the internet just once to download it — after that you can translate ` +
      `this pair fully offline, anytime.`,
    );
    this.name = 'MlkitOfflineError';
  }
}

// Quick connectivity probe. ML Kit's downloadIfNeeded blocks indefinitely when the device
// is offline and the pack is missing (it waits for a network that never comes), so we check
// first and fail fast. Endpoint returns HTTP 204 instantly when online.
async function isOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    await fetch('https://clients3.google.com/generate_204', { signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

// Backstop so a stalled download can never spin the loading UI forever.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// fast-mlkit-translate-text is stateful: prepare(source, target) sets the active pair,
// then translate(text) uses it. Cache the last-prepared pair so we only re-prepare (and
// re-check downloads) when the language pair actually changes.
let preparedKey: string | null = null;

async function preparePair(source: Languages, target: Languages): Promise<void> {
  const key = `${source}>${target}`;
  if (key === preparedKey) return;

  const store = useStore.getState();

  // Do we already have both packs on device? If so, prepare() is instant and offline.
  let needsDownload = true;
  try {
    const [srcOk, tgtOk] = await Promise.all([
      FastTranslator.isLanguageDownloaded(source),
      FastTranslator.isLanguageDownloaded(target),
    ]);
    needsDownload = !srcOk || !tgtOk;
  } catch {
    needsDownload = true; // if we can't tell, assume a download may be needed
  }

  const label = `${source} → ${target}`;

  let startedAt = 0;
  if (needsDownload) {
    // Offline + pack missing → fail fast instead of letting ML Kit hang on the download.
    if (!(await isOnline())) throw new MlkitOfflineError(label);
    store.setMlkitPack('downloading', label);
    startedAt = Date.now();
  }

  try {
    await withTimeout(
      FastTranslator.prepare({ source, target, downloadIfNeeded: true }),
      needsDownload ? 90000 : 15000,
    );
    preparedKey = key;
  } catch {
    // Download stalled or dropped mid-way — treat as an offline/connection failure.
    throw new MlkitOfflineError(label);
  } finally {
    if (needsDownload) {
      // Keep the "Downloading…" indicator on screen long enough to read, even when the
      // pack turns out to be cached / downloads instantly (otherwise it just flickers).
      const elapsed = Date.now() - startedAt;
      const MIN_VISIBLE_MS = 900;
      if (elapsed < MIN_VISIBLE_MS) {
        await new Promise((r) => setTimeout(r, MIN_VISIBLE_MS - elapsed));
      }
      store.setMlkitPack('idle');
    }
  }
}

// ML Kit's translate() needs an explicit source. Our text/image pipelines pass 'auto',
// so we try ML Kit's own language identification first, then fall back to the language
// the user picked in the UI.
async function resolveSourceCode(sourceCode: string, text: string): Promise<string> {
  if (sourceCode !== 'auto') return sourceCode;
  try {
    const tag = await FastTranslator.identify(text); // BCP-47 tag, or 'und' if unknown
    if (tag && tag !== 'und') return tag;
  } catch {
    // fall through to the user's selected source
  }
  return useStore.getState().sourceLang;
}

/**
 * Translate via Google ML Kit on-device NMT (fast-mlkit-translate-text). Downloads the
 * source+target language packs (~30 MB each) on first use, then works fully offline.
 *
 * Throws MlkitUnsupportedLanguageError for languages ML Kit can't handle
 * (Burmese, Khmer, Lao, Nepali, Sinhala, Cantonese).
 */
export async function mlkitTranslate(
  text: string,
  sourceCode: string,
  targetCode: string,
): Promise<string> {
  const resolvedSource = await resolveSourceCode(sourceCode, text);

  const source = toMlkitLanguage(resolvedSource);
  const target = toMlkitLanguage(targetCode);
  if (!source) throw new MlkitUnsupportedLanguageError(resolvedSource);
  if (!target) throw new MlkitUnsupportedLanguageError(targetCode);

  // Same language in and out — nothing to do.
  if (source === target) return text;

  await preparePair(source, target);
  return FastTranslator.translate(text);
}

/**
 * Force the language packs for a pair to download ahead of time — call this when the user
 * changes languages so the first real translation isn't blocked on a ~30 MB fetch.
 * Fire-and-forget; resolves false if the pair is unsupported or the download fails.
 */
export async function ensureMlkitModels(sourceCode: string, targetCode: string): Promise<boolean> {
  const source = toMlkitLanguage(sourceCode === 'auto' ? useStore.getState().sourceLang : sourceCode);
  const target = toMlkitLanguage(targetCode);
  if (!source || !target || source === target) return false;
  try {
    await preparePair(source, target);
    return true;
  } catch {
    preparedKey = null;
    return false;
  }
}
