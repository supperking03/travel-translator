import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '@/store/useStore';

// Shared backend on the audio-story-platform (same endpoint wattpad-audio uses); reviews are
// stored generically keyed by `app`, so we just tag ours as "nomad-translator".
const API_BASE = 'https://audio-story-platform-web-vot4.vercel.app';
const APP_ID = 'nomad-translator';
const DEVICE_ID_KEY = 'nomad.review.device_id';

async function getDeviceId(): Promise<string> {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const next = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

/**
 * POST a low-star (1–4) review + optional feedback to the backend so we capture it privately
 * instead of it landing on the store. 5-star reviews go straight to the App/Play Store and
 * never hit this. Throws on non-2xx so the UI can show an error.
 */
export async function submitAppReview(rating: number, comment?: string): Promise<void> {
  const body = {
    app: APP_ID,
    rating,
    comment: comment?.trim() || undefined,
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version,
    locale: useStore.getState().appLanguage,
    deviceId: await getDeviceId(),
  };

  const res = await fetch(`${API_BASE}/api/mobile/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Review submit failed (${res.status}).`);
}
