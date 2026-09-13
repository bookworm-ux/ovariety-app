// oxlint-disable-next-line eslint-plugin-import/no-unassigned-import
import '../global.css';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as DevClient from 'expo-dev-client';
import { HeroUINativeProvider, useThemeColor } from 'heroui-native';
import { Uniwind } from 'uniwind';
import {
  ErrorBoundary as ExpoErrorBoundary,
  type ErrorBoundaryProps,
  SplashScreen,
  Stack,
} from 'expo-router';

import { useCloudSyncStore } from '@/lib/cloud-sync';
import { registerServiceWorker } from '@/lib/registerServiceWorker';
import { reportErrorToParent } from '@/lib/reportPreviewError';
import { InstallPrompt } from '@/components/InstallPrompt';
import { useHealthStore } from '@/lib/health-store';

/**
 * Custom ErrorBoundary that reports React render errors to the parent window (Bilt preview iframe)
 * and then renders the default Expo error UI.
 */
function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    if (Platform.OS === 'web' && error) {
      const message = [error.message, error.stack].filter(Boolean).join('\n');
      reportErrorToParent(message);
    }
  }, [error]);
  return <ExpoErrorBoundary error={error} retry={retry} />;
}

export { ErrorBoundary };

// Starter is light-only by default. Remove this when implementing requested dark mode.
Uniwind.setTheme('light');

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const background = useThemeColor('background');
  const hydrateHealthData = useHealthStore((state) => state.hydrate);
  const hydrated = useHealthStore((state) => state.hydrated);
  const revision = useHealthStore((state) => state.revision);
  const initializeCloud = useCloudSyncStore((state) => state.initialize);
  const syncEnabled = useCloudSyncStore((state) => state.syncEnabled);
  const session = useCloudSyncStore((state) => state.session);
  const syncNow = useCloudSyncStore((state) => state.syncNow);
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_600SemiBold,
  });
  const [startupComplete, setStartupComplete] = useState(false);
  const revealStartedRef = useRef(false);

  const completeStartup = useCallback(() => {
    if (revealStartedRef.current) return;

    revealStartedRef.current = true;
    void SplashScreen.hideAsync().finally(() => {
      setStartupComplete(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) void hydrateHealthData();
  }, [hydrateHealthData, hydrated]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void initializeCloud().then((cleanup) => {
      unsubscribe = cleanup;
    });
    return () => unsubscribe?.();
  }, [initializeCloud]);

  useEffect(() => {
    if (!hydrated || !session || !syncEnabled) return undefined;
    const timer = setTimeout(() => void syncNow().catch(() => undefined), revision === 0 ? 0 : 800);
    return () => clearTimeout(timer);
  }, [hydrated, revision, session, syncEnabled, syncNow]);

  // Report uncaught JS errors and unhandled promise rejections to parent (Bilt preview iframe)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const handleError = (event: ErrorEvent) => {
      const message = event.error?.stack ?? event.message ?? 'Unknown error';
      reportErrorToParent(message);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const err = event.reason;
      const message =
        err instanceof Error ? [err.message, err.stack].filter(Boolean).join('\n') : String(err);
      reportErrorToParent(message);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Inject Google Fonts link tag for web to ensure fonts load through proxy
  // Also register font family names as fallback if expo-font fails
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Check if link already exists
      const existingLink = document.querySelector(
        'link[href*="fonts.googleapis.com/css2?family=Inter"]',
      );

      if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }

      // Note: The @import in global.css and the link tag above ensure Inter font loads
      // expo-font will register the font family names (Inter_400Regular, etc.)
      // If expo-font fails due to proxy issues, the fonts should still be available
      // via the direct Google Fonts CDN link, though the specific font family names
      // might not be registered. The app should still render with Inter font.
    }
  }, []);

  useEffect(() => {
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (__DEV__ && Platform.OS !== 'web' && !isExpoGo) {
      const timer = setTimeout(() => {
        DevClient.closeMenu();
        DevClient.hideMenu();
      }, 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (error) {
      completeStartup();
    }
  }, [completeStartup, error]);

  if (!loaded && !error) {
    return null;
  }

  if (!startupComplete && loaded) {
    return (
      <View
        accessibilityLabel="Ovariety"
        onLayout={completeStartup}
        style={{
          alignItems: 'center',
          backgroundColor: '#F6DDE5',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: '#512A3C',
            fontFamily: 'PlayfairDisplay_600SemiBold',
            fontSize: 48,
          }}
        >
          Ovariety
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            contentStyle: { backgroundColor: background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ title: 'Set up', headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ title: 'Today', headerShown: false }} />
          <Stack.Screen name="labs" options={{ title: 'Lab values', presentation: 'modal' }} />
          <Stack.Screen name="account" options={{ title: 'Account' }} />
          <Stack.Screen name="prediction" options={{ title: 'Your prediction' }} />
        </Stack>
        <InstallPrompt />
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
