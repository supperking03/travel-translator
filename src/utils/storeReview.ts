import Constants from 'expo-constants';
import { Platform as ExpoPlatform, requireNativeModule } from 'expo-modules-core';
import { Linking } from 'react-native';

type StoreReviewModule = {
  isAvailableAsync?: () => Promise<boolean>;
  requestReview?: () => Promise<void>;
};

let nativeModule: StoreReviewModule | null = null;

function getNativeModule(): StoreReviewModule | null {
  if (nativeModule) return nativeModule;

  try {
    nativeModule = requireNativeModule<StoreReviewModule>('ExpoStoreReview');
    return nativeModule;
  } catch {
    return null;
  }
}

export async function isAvailableAsync(): Promise<boolean> {
  return (await getNativeModule()?.isAvailableAsync?.()) ?? false;
}

function storeUrl(): string | null {
  const expoConfig = Constants.expoConfig;
  if (ExpoPlatform.OS === 'ios' && expoConfig?.ios) {
    return expoConfig.ios.appStoreUrl ?? null;
  }
  if (ExpoPlatform.OS === 'android' && expoConfig?.android) {
    return expoConfig.android.playStoreUrl ?? null;
  }
  return null;
}

export async function requestReview(): Promise<void> {
  const module = getNativeModule();
  if (module?.requestReview) {
    await module.requestReview();
    return;
  }

  const url = storeUrl();
  if (!url) return;

  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url);
  }
}

