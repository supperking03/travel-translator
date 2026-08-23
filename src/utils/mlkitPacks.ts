import FastTranslator from 'fast-mlkit-translate-text';
import type { Languages } from 'fast-mlkit-translate-text';
import { toMlkitLanguage } from '@/constants/mlkitLanguages';

// Per-language ML Kit pack management: which packs are on device, and downloading them
// one at a time with a timeout, retries and a step counter. Packs are keyed by ML Kit's
// BCP-47 tag (e.g. "en", "vi", "tl"); several of our codes can share one tag (fil→tl,
// zh-tw→zh).
//
// Everything that downloads a pack goes through ensurePacks() — the language picker and
// the translate path both do. Do NOT lean on ML Kit's implicit `downloadIfNeeded` inside
// translate(): it is untimed, reports nothing, and on both platforms the native module
// has a path where its promise never settles.

/** One pack is ~30 MB. Hotel wifi and mobile data can legitimately need minutes, so the
 *  budget is generous — this timeout exists to break the never-settles paths in
 *  fast-mlkit-translate-text, not to police slow networks:
 *    · Android downloadLanguageModel() re-checks isModelDownloaded() inside the download
 *      branch and simply drops the promise if that second check comes back true.
 *    · iOS keys its success/fail notification observers by language, so a second
 *      concurrent call for the same language orphans the first one's promise. */
const PACK_TIMEOUT_MS = 6 * 60 * 1000;

/** Dropped connections are the norm on the move, and ML Kit keeps what it already
 *  fetched, so a retry usually resumes rather than restarts. Only *fast* failures are
 *  retried — see downloadPack(). */
const RETRY_DELAYS_MS = [2000, 5000];

/** No usable connection, so nothing was attempted. Distinct from PackDownloadError
 *  because the two need very different wording: this one means "come back when you have
 *  signal", the other means "you had signal and it still didn't work — try again". */
export class PackOfflineError extends Error {
  constructor() {
    super('No internet connection');
    this.name = 'PackOfflineError';
  }
}

export class PackDownloadError extends Error {
  constructor(public pack: Languages, public cause?: unknown) {
    super(`Failed to download the ${pack} language pack`);
    this.name = 'PackDownloadError';
  }
}

/** Progress for a multi-pack download: "Vietnamese (2 of 3)". */
export type PackStep = { name: Languages; current: number; total: number };

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

class TimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// Connectivity probe, raced across two endpoints on purpose: clients3.google.com alone is
// blocked on plenty of networks (China, some corporate wifi) where the device is perfectly
// online, and telling those users "No Internet" is exactly the misleading message we're
// trying to get rid of.
const PROBE_URLS = [
  'https://clients3.google.com/generate_204',
  'https://cloudflare.com/cdn-cgi/trace',
];

export function isOnline(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const controller = new AbortController();
    let pending = PROBE_URLS.length;

    const settle = (online: boolean) => {
      clearTimeout(timer);
      controller.abort(); // cancels whichever probe is still in flight
      resolve(online);
    };

    const timer = setTimeout(() => settle(false), 4000);

    for (const url of PROBE_URLS) {
      fetch(url, { signal: controller.signal }).then(
        () => settle(true),
        () => { if (--pending === 0) settle(false); },
      );
    }
  });
}

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

// One shared promise per language so the picker and the translate path can ask for the
// same pack at the same time without ML Kit seeing two concurrent downloads for it.
const inFlight = new Map<Languages, Promise<void>>();

/** Download one pack, retrying transient failures. Throws PackDownloadError on give-up. */
function downloadPack(name: Languages): Promise<void> {
  const existing = inFlight.get(name);
  if (existing) return existing;

  const run = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) await delay(RETRY_DELAYS_MS[attempt - 1]);
      try {
        const ok = await withTimeout(FastTranslator.downloadLanguageModel(name), PACK_TIMEOUT_MS);
        if (ok) return;
        lastError = new Error('downloadLanguageModel returned false');
      } catch (e) {
        lastError = e;
        // A timeout means we already gave it the full budget. Retrying would triple an
        // already six-minute wait for a user who is very likely on a dead connection.
        if (e instanceof TimeoutError) break;
      }
    }
    throw new PackDownloadError(name, lastError);
  })();

  const tracked = run.finally(() => inFlight.delete(name));
  inFlight.set(name, tracked);
  return tracked;
}

/** Which of these packs are not on the device yet, in the order given. */
export async function missingPacks(names: Languages[]): Promise<Languages[]> {
  const unique = [...new Set(names)];
  const checks = await Promise.all(
    unique.map(async (name) => {
      try {
        return (await FastTranslator.isLanguageDownloaded(name)) ? null : name;
      } catch {
        return name; // can't tell → assume missing; downloadPack() no-ops if it isn't
      }
    }),
  );
  return checks.filter((n): n is Languages => n !== null);
}

/**
 * Make sure every pack in `names` is on the device, downloading the missing ones **one at
 * a time** so each gets its own timeout and the step counter stays truthful. `onStep` runs
 * before each download starts.
 *
 * Throws PackOfflineError if there's no connection and something is missing, or
 * PackDownloadError for the first pack that won't come down. Packs already fetched in this
 * run stay on the device either way.
 */
export async function ensurePacks(
  names: Languages[],
  onStep?: (step: PackStep) => void,
): Promise<void> {
  const missing = await missingPacks(names);
  if (missing.length === 0) return;

  // Fail fast instead of burning the pack timeout on a network that isn't there.
  if (!(await isOnline())) throw new PackOfflineError();

  for (let i = 0; i < missing.length; i++) {
    onStep?.({ name: missing[i], current: i + 1, total: missing.length });
    await downloadPack(missing[i]);
  }
}

/** Download the pack for one of our language codes. Throws PackOfflineError /
 *  PackDownloadError so the caller can word the failure correctly. */
export async function downloadLanguagePack(code: string): Promise<void> {
  const name = toMlkitLanguage(code);
  if (!name) throw new Error(`No ML Kit pack for language code "${code}"`);
  await ensurePacks([name]);
}
