/**
 * Lightweight analytics wrapper around PostHog.
 *
 * Paste your Project API Key into POSTHOG_API_KEY (PostHog → Project Settings → API Key,
 * starts with `phc_`) and pick the host for your region below. Until a key is set every
 * call is a safe no-op, so the app runs fine without analytics configured.
 *
 * Events captured: app_open, screen_view, onboarding_complete,
 * translate (engine + mode: text/image/voice + langs), tts_speak, copy_translation,
 * review_prompted, and the ML Kit per-language pack funnel:
 * mlkit_pack_download_start / mlkit_pack_download_success ({pair, ms}) /
 * mlkit_offline_blocked ({pair}), plus language_unsupported_selected ({code}).
 */
import { PostHog } from 'posthog-react-native';

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
