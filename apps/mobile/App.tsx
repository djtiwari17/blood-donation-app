import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import type { Subscription } from 'expo-notifications';
import { AppProvider } from './src/context/AppContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/auth.store';
import { ACCESS_TOKEN_KEY } from './src/api/client';
import { wsService } from './src/services/websocket';
import {
  registerForPushNotifications,
  syncPushToken,
  addResponseListener,
} from './src/services/push-notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

// Runs inside the Zustand/React tree — handles push + WebSocket init on auth change
function AppInit() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const responseListenerRef = useRef<Subscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      wsService.disconnect();
      responseListenerRef.current?.remove();
      responseListenerRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      // Push notification token — register + sync to backend
      if (Platform.OS !== 'web') {
        const pushToken = await registerForPushNotifications();
        if (!cancelled && pushToken) await syncPushToken(pushToken);
      }

      // WebSocket connection
      if (!cancelled) {
        const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        if (accessToken) wsService.connect(accessToken);
      }
    })().catch(() => {});

    // Handle notification tap when app was in background / killed
    responseListenerRef.current = addResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (__DEV__) console.log('[Push] notification tapped, relatedId:', data?.relatedId);
      // Phase 8: add navigationRef.current?.navigate(...) deep-link here
    });

    return () => {
      cancelled = true;
      responseListenerRef.current?.remove();
      responseListenerRef.current = null;
    };
  }, [isAuthenticated]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <AppInit />
          <RootNavigator />
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
