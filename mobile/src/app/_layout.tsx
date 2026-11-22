import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_600SemiBold,
  AtkinsonHyperlegibleNext_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import { OnlineProvider } from '@/ask/OnlineProvider';
import { DATABASE_NAME, migrate } from '@/db/database';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

// SunSafe reminders are shown even while LUMA is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AppStack() {
  const t = useTheme();
  useEffect(() => {
    if (t.ready) SplashScreen.hideAsync().catch(() => {});
  }, [t.ready]);
  if (!t.ready) return null;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: t.reduceMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: t.palette.background },
      }}
    />
  );
}

export default function RootLayout() {
  // Fonts ship inside the app, so they load offline.
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_600SemiBold,
    AtkinsonHyperlegibleNext_700Bold,
  });
  // If the fonts cannot load, continue with system fonts rather than a blank screen.
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
          <ThemeProvider>
            <OnlineProvider>
              <AppStack />
            </OnlineProvider>
          </ThemeProvider>
        </SQLiteProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
