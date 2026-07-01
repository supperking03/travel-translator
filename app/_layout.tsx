import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useDSColors, useDSIsDark } from '@/constants/designSystem';
import { track } from '@/utils/analytics';
import { useOtaUpdates } from '@/hooks/useOtaUpdates';

export default function RootLayout() {
  const C      = useDSColors();
  const isDark = useDSIsDark();

  // Fires once per cold start.
  useEffect(() => { track('app_open'); }, []);

  // Check EAS Update for a newer JS bundle on launch (silent, prod-only).
  useOtaUpdates();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.background },
            headerTintColor: C.textPrimary,
            headerTitleStyle: { fontWeight: '700' as const, fontSize: 17, color: C.textPrimary },
            contentStyle: { backgroundColor: C.background },
            headerShadowVisible: false,
            headerBackTitle: '',
          }}
        >
          <Stack.Screen name="index"            options={{ headerShown: false }} />
          <Stack.Screen name="onboarding"       options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen
            name="settings"
            options={{
              title: 'Settings',
              presentation: 'modal',
              headerShown: false,
              headerStyle: { backgroundColor: C.background },
            }}
          />
          <Stack.Screen
            name="image-translate"
            options={{
              title: 'Image Translation',
              presentation: 'modal',
              headerStyle: { backgroundColor: C.background },
            }}
          />
          <Stack.Screen
            name="review"
            options={{
              presentation: 'modal',
              headerShown: false,
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
