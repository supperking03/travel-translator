import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/theme';

export default function RootLayout() {
  const colors = useTheme();

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 17, color: colors.text },
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerBackTitle: '',
        }}
      >
        {/* Main translator — no header; custom status banner is built into the screen */}
        <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />
        {/* Offline Language Pack — modal sheet */}
        <Stack.Screen
          name="settings"
          options={{
            title: 'Offline Language Pack',
            presentation: 'modal',
            headerStyle: { backgroundColor: colors.background },
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
