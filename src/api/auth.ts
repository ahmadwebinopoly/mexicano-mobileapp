/**
 * Auth API – register, login, logout
 * Base URL: EXPO_PUBLIC_API_BASE_URL or app.config.js extra.apiBaseUrl
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveToken, getToken, removeToken } from '../storagetank';
import { getApiBaseUrl } from './apiConfig';

const USER_ADDRESS_KEY = 'userAddress';

const BASE_URL = getApiBaseUrl();
const GOOGLE_LOGIN_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_LOGIN_URL) ||
  `${BASE_URL}/api/auth/google`;

const ENDPOINTS = {
  register: `${BASE_URL}/api/auth/register`,
  login: `${BASE_URL}/api/auth/login`,
  google: GOOGLE_LOGIN_URL,
  logout: `${BASE_URL}/api/auth/logout`,
} as const;

export interface RegisterPayload {
  name?: string;
  phone?: string;
  email: string;
  password: string;
}

/**
 * POST /api/auth/register – create account
 * Body: { name?, phone?, email, password }
 */
export async function register(payload: RegisterPayload): Promise<unknown> {
  const res = await fetch(ENDPOINTS.register, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name?.trim() || undefined,
      phone: payload.phone?.trim() || undefined,
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error: ${res.status} ${res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token?: string;
  accessToken?: string;
  access_token?: string;
  [key: string]: unknown;
}

export interface GoogleLoginResponse {
  token?: string;
  user?: { id?: string; email?: string; name?: string; phone?: string; role?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * POST /api/auth/google – mobile flow (ID token)
 * Body: { idToken }
 * Returns: { user, token } (token is saved locally via storagetank).
 */
export async function googleLogin(idToken: string): Promise<GoogleLoginResponse> {
  const t = String(idToken || '').trim();
  if (!t) throw new Error('Google sign-in failed. Missing idToken.');

  const res = await fetch(ENDPOINTS.google, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: t }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Google login failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json().catch(() => ({}))) as GoogleLoginResponse;
  const token = data.token;
  if (typeof token === 'string' && token.length > 0) {
    await saveToken(token);
  }
  return data;
}

/**
 * POST /api/auth/login – sign in
 * Body: { email, password }
 * Returns response with token (saved locally via storagetank).
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await fetch(ENDPOINTS.login, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json().catch(() => ({}))) as LoginResponse;
  const token =
    data.token ?? data.accessToken ?? data.access_token;
  if (typeof token === 'string' && token.length > 0) {
    await saveToken(token);
  }
  return data;
}

/**
 * POST /api/auth/logout – invalidate token (best-effort) and clear local token.
 */
export async function logout(): Promise<void> {
  const token = await getToken();
  try {
    if (token) {
      await fetch(ENDPOINTS.logout, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
    }
  } finally {
    await removeToken();
    await AsyncStorage.removeItem(USER_ADDRESS_KEY);
  }
}
