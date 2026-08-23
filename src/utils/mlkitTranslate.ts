import FastTranslator from 'fast-mlkit-translate-text';
import type { Languages } from 'fast-mlkit-translate-text';
import { useStore } from '@/store/useStore';
import { toMlkitLanguage } from '@/constants/mlkitLanguages';
import { ensurePacks, missingPacks, PackDownloadError, PackOfflineError } from '@/utils/mlkitPacks';
import { track } from '@/utils/analytics';

export class MlkitUnsupportedLanguageError extends Error {
  constructor(public code: string) {
    super(`ML Kit has no offline model for "${code}"`);
    this.name = 'MlkitUnsupportedLanguageError';
  }
}

/**
 * A language pack is missing and we could not get it. `reason` separates the two cases the
 * UI has to word very differently:
 *   'offline'         — no connection, nothing was attempted. Retrying now won't help.
 *   'download_failed' — we were online and the download still failed or stalled out.
 */
export class MlkitOfflineError extends Error {
  constructor(
    public pairLabel: string,
    public reason: 'offline' | 'download_failed' = 'offline',
  ) {
    super(
      reason === 'offline'
        ? `The "${pairLabel}" language pack needs a one-time download (~30 MB). ` +
          `Connect to the internet just once to download it — after that you can translate ` +
          `this pair fully offline, anytime.`
        : `The "${pairLabel}" language pack (~30 MB) couldn't finish downloading. ` +
          `Check your connection and try again — the part already downloaded is kept.`,
    );
    this.name = 'MlkitOfflineError';
  }
}

// Backstop for translate() itself. The packs are on device by the time we call it, so this
// only ever fires if ML Kit decides it still needs something from the network (it pivots
// non-English pairs through English) — generous enough for that, short of forever.
const TRANSLATE_TIMEOUT_MS = 3 * 60 * 1000;

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

/**
 * Get both packs on device, then point the native translator at the pair.
 *
 * Note what is deliberately NOT happening here: `prepare()` is called with
 * downloadIfNeeded false. On both platforms prepare() only constructs the translator and
 * resolves immediately — the flag makes the *next* translate() call do the download,
 * untimed and with the loading UI already dismissed. We download up front instead.
 */
async function preparePair(source: Languages, target: Languages): Promise<void> {
  const key = `${source}>${target}`;
  if (key === preparedKey) return;

  const store = useStore.getState();
  const label = `${source} → ${target}`;

  const missing = await missingPacks([source, target]);

  if (missing.length > 0) {
    const startedAt = Date.now();
    track('mlkit_pack_download_start', { pair: label, packs: missing.join(',') });
    store.setMlkitPack('downloading', missing[0]);

    try {
      await ensurePacks([source, target], ({ name, current, total }) => {
        // "Vietnamese" on its own when there's only one pack left to fetch, otherwise
        // "Vietnamese (2/3)" so a multi-minute wait doesn't look like a frozen spinner.
        store.setMlkitPack('downloading', total > 1 ? `${name} (${current}/${total})` : name);
      });
      track('mlkit_pack_download_success', {
        pair: label,
        packs: missing.join(','),
        ms: Date.now() - startedAt,
      });
    } catch (e) {
      if (e instanceof PackOfflineError) {
        track('mlkit_offline_blocked', { pair: label, packs: missing.join(',') });
        throw new MlkitOfflineError(label, 'offline');
      }
      const failed = e instanceof PackDownloadError ? e.pack : label;
      track('mlkit_pack_download_failed', {
        pair: label,
        pack: String(failed),
        ms: Date.now() - startedAt,
      });
      throw new MlkitOfflineError(String(failed), 'download_failed');
    } finally {
      store.setMlkitPack('idle');
    }
  }

  await FastTranslator.prepare({ source, target, downloadIfNeeded: false });
  preparedKey = key;
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

  try {
    return await withTimeout(FastTranslator.translate(text), TRANSLATE_TIMEOUT_MS);
  } catch (e) {
    // The pair was prepared, so a failure here means ML Kit wanted the network after all
    // (pivot model) and didn't get it. Re-prepare next time in case its state is stale.
    preparedKey = null;
    if (e instanceof Error && e.message === 'timeout') {
      throw new MlkitOfflineError(`${source} → ${target}`, 'download_failed');
    }
    throw e;
  }
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
