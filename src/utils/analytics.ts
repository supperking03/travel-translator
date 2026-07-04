/**
 * Lightweight analytics wrapper around PostHog.
 *
 * Every event automatically carries super properties (app_version, native_build, platform,
 * runtime_version, update_id, channel) via posthog.register — no need to pass them per call.
 *
 * Events: app_open, screen_view, onboarding_complete, onboarding_step_viewed,
 * translate (engine, mode, langs, chars), translate_failed, tts_speak (source_mode, chars),
 * copy_translation, review_prompted + local_review_*, mlkit_pack_* / mlkit_offline_blocked,
 * language_unsupported_selected, feature_first_used, session_summary.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { PostHog } from 'posthog-react-native';
import { useStore } from '@/store/useStore';

const POSTHOG_API_KEY = 'phc_qpmxHBjCxWp3DroxGwKHxkjZGzoTDJccsAawW2e6LLPo';
// US cloud: https://us.i.posthog.com · EU cloud: https://eu.i.posthog.com
const POSTHOG_HOST = 'https://us.i.posthog.com';

export const posthog: PostHog | null = POSTHOG_API_KEY
  ? new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      // Production batching: send after 20 events or every 30s (also flushes when
      // the app backgrounds) — easy on battery/network.
      flushAt: 20,
      flushInterval: 30000,
      // We only capture events — no feature flags / surveys / remote config. Turning these
      // off stops the startup remote-config fetch that otherwise logs
      // "Remote config could not be loaded" network errors.
      disableRemoteConfig: true,
      preloadFeatureFlags: false,
      disableSurveys: true,
    })
  : null;

// Attach build/version context to every event so we can slice metrics by app version and
// know which OTA bundle a user is on.
try {
  posthog?.register({
    app_version: Constants.expoConfig?.version ?? 'unknown',
    native_build:
      Constants.expoConfig?.ios?.buildNumber ??
      String(Constants.expoConfig?.android?.versionCode ?? 'unknown'),
    platform: Platform.OS,
    runtime_version: Updates.runtimeVersion ?? 'unknown',
    update_id: Updates.updateId ?? 'embedded',
    channel: Updates.channel ?? 'none',
    is_embedded: Updates.isEmbeddedLaunch,
  });
} catch {
  /* never let analytics setup break startup */
}

// Logs every captured/flushed event to the Metro console (dev builds only).
if (__DEV__) posthog?.debug();

type Props = Record<string, string | number | boolean>;

export function track(event: string, props?: Props): void {
  try {
    posthog?.capture(event, props);
  } catch {
    // analytics must never break the app
  }
}

export function trackScreen(name: string): void {
  try {
    posthog?.screen(name);
  } catch {
    /* no-op */
  }
}

// ─── feature_first_used ─────────────────────────────────────────────────────
// Fires once, ever, the first time a user touches a given feature — the signal for "this
// user is engaged enough to see an offer". Backed by a persisted set in the store.
export function trackFeatureFirstUse(feature: string): void {
  try {
    if (useStore.getState().markFeatureUsed(feature)) {
      track('feature_first_used', { feature });
    }
  } catch {
    /* no-op */
  }
}

// ─── session_summary ────────────────────────────────────────────────────────
// Rolling tally of what happens between foreground and background, flushed as one event when
// the app backgrounds — so we can see what a typical session looks like (where to put paywalls).
type SessionKey =
  | 'translations'
  | 'text_translations'
  | 'voice_translations'
  | 'image_translations'
  | 'tts'
  | 'chars'
  | 'failures'
  | 'pack_downloads';

function emptySession(now: number) {
  return {
    started_at: now,
    translations: 0,
    text_translations: 0,
    voice_translations: 0,
    image_translations: 0,
    tts: 0,
    chars: 0,
    failures: 0,
    pack_downloads: 0,
  };
}

let session = emptySession(Date.now());

export function bumpSession(key: SessionKey, by = 1): void {
  session[key] += by;
}

/** Emit the session tally (if there was any activity) and start a fresh one. */
export function flushSessionSummary(): void {
  try {
    const { started_at, ...counts } = session;
    const active = Object.values(counts).some((v) => v > 0);
    if (active) {
      track('session_summary', {
        ...counts,
        duration_sec: Math.round((Date.now() - started_at) / 1000),
      });
    }
  } catch {
    /* no-op */
  } finally {
    session = emptySession(Date.now());
  }
}
