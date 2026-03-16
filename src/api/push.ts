/**
 * Push Notifications API – register/unregister device for Expo push
 * Base URL: EXPO_PUBLIC_API_BASE_URL or app.config.js extra.apiBaseUrl
 */

import { getApiBaseUrl } from './apiConfig';

const PUSH_REGISTER_URL = `${getApiBaseUrl()}/api/push/register`;

export interface RegisterPushPayload {
  token: string;
  platform?: 'expo' | 'android' | 'ios';
}

/**
 * POST /api/push/register – register device for push notifications
 * Call after user grants permission and you have the Expo push token.
 */
export async function registerPush(payload: RegisterPushPayload): Promise<void> {
  const res = await fetch(PUSH_REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: payload.token,
      platform: payload.platform ?? 'expo',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Push register failed: ${res.status}`);
  }
}

/**
 * DELETE /api/push/register – unregister device (e.g. on logout)
 */
export async function unregisterPush(token: string): Promise<void> {
  const res = await fetch(PUSH_REGISTER_URL, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Push unregister failed: ${res.status}`);
  }
}
