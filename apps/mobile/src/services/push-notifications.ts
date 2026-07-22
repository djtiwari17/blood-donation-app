import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Get the Expo push token (works in dev without google-services.json)
  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

export async function syncPushToken(token: string): Promise<void> {
  try {
    await apiClient.post('/notifications/token', { token, platform: Platform.OS });
  } catch (err) {
    // Non-fatal — token sync can be retried on next app launch
    console.warn('[Push] Failed to register push token:', err);
  }
}

export async function removePushToken(token: string): Promise<void> {
  try {
    await apiClient.delete('/notifications/token', { data: { token } });
  } catch {
    // Non-fatal — stale tokens are also pruned server-side on delivery failure
  }
}

export function addNotificationListener(
  handler: (notification: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
