/**
 * Local storage for auth token (storagetank).
 * Uses AsyncStorage; token is persisted across app restarts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@mexicano_auth_token';

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}
