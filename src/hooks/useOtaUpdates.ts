import { useEffect } from 'react';
import * as Updates from 'expo-updates';

// Silent over-the-air updates (EAS Update). On cold start we check for a newer JS bundle for
// this runtimeVersion and, if there is one, fetch it and reload into it. Best-effort and
// completely silent — a no-op in dev / Expo Go (Updates.isEnabled is false) and never throws
// into the app. Native config lives in app.json ("updates" + "runtimeVersion").
async function checkForOtaUpdate(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    // Updates are best-effort — never block or crash the app over one.
  }
}

export function useOtaUpdates(): void {
  useEffect(() => {
    void checkForOtaUpdate();
  }, []);
}
