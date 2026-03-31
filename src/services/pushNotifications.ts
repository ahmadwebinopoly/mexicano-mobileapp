/**
 * Push Notifications Service
 * Handles permission, Expo push token, and registration with backend.
 * Registers when user is logged in; unregisters on logout.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { registerPush, unregisterPush } from '../api/push';

const PUSH_TOKEN_KEY = '@mexicano_push_token';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Get the stored push token (for unregister on logout)
 */
export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

/**
 * Request permission, get Expo push token, register with backend, and store token.
 * Call after login or on app load when user is logged in.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    if (__DEV__) console.warn('[Push] Skipped: Use a physical device for push notifications.');
    return;
  }

  // Android: create notification channel (required for notifications to show)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FECB4D',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    if (finalStatus !== 'granted') return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId && __DEV__) {
    console.warn('[Push] No projectId. Run `eas init` to set up EAS.');
  }

  let tokenData;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
  } catch (err) {
    if (__DEV__) console.warn('[Push] getExpoPushTokenAsync failed:', err);
    return;
  }

  const token = tokenData?.data;
  if (!token) return;

  try {
    await registerPush({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'expo',
    });
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    if (__DEV__) console.log('[Push] Registered:', token.slice(0, 35) + '...');
  } catch (err) {
    if (__DEV__) console.warn('[Push] Register failed:', err);
  }
}

/**
 * Unregister device from push notifications. Call on logout.
 */
export async function unregisterFromPushNotifications(): Promise<void> {
  const token = await getStoredPushToken();
  if (!token) return;

  try {
    await unregisterPush(token);
  } catch (err) {
    if (__DEV__) console.warn('[Push] Unregister failed:', err);
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  }
}
