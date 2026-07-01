import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

const IOS_APP_ID = '6766855589';
const ANDROID_PACKAGE = 'com.theluxenomad.freeofflinetranslator';

export async function isAvailableAsync(): Promise<boolean> {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function configuredStoreUrl(): string | null {
  const expoConfig = Constants.expoConfig;
  if (Platform.OS === 'ios' && expoConfig?.ios) {
    return expoConfig.ios.appStoreUrl ?? null;
  }
  if (Platform.OS === 'android' && expoConfig?.android) {
    return expoConfig.android.playStoreUrl ?? null;
  }
  return null;
}

function storeUrls(): string[] {
  const configured = configuredStoreUrl();

  if (Platform.OS === 'ios') {
    return [
      `itms-apps://itunes.apple.com/app/id${IOS_APP_ID}?action=write-review`,
      configured,
      `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`,
    ].filter(Boolean) as string[];
  }

  if (Platform.OS === 'android') {
    const packageName = Constants.expoConfig?.android?.package ?? ANDROID_PACKAGE;
    return [
      `market://details?id=${packageName}`,
      configured,
      `https://play.google.com/store/apps/details?id=${packageName}`,
    ].filter(Boolean) as string[];
  }

  return configured ? [configured] : [];
}

export async function requestReview(): Promise<void> {
  let lastError: unknown;

  for (const url of storeUrls()) {
    try {
      await Linking.openURL(url);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('No store review URL configured.');
}
