import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDSColors, useDSIsDark } from '@/constants/designSystem';

export default function RootLayout() {
  const C      = useDSColors();
  const isDark = useDSIsDark();

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.background },
          headerTintColor: C.textPrimary,
          headerTitleStyle: { ...{ fontWeight: '700' as const, fontSize: 17 }, color: C.textPrimary },
          contentStyle: { backgroundColor: C.background },
          headerShadowVisible: false,
          headerBackTitle: '',
        }}
      >
        <Stack.Screen name="index"       options={{ headerShown: false }} />
        <Stack.Screen name="onboarding"  options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Offline Language Pack',
            presentation: 'modal',
            headerStyle: { backgroundColor: C.background },
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
