import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: '700', color: COLORS.text },
          contentStyle: { backgroundColor: COLORS.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'Travel Translator', headerLargeTitle: false }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: 'Model Settings', presentation: 'modal' }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
