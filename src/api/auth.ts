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

// Auth-code exchange endpoint (required by new Expo Google flow).
// Default matches provided backend URL, but can be overridden via env.
const GOOGLE_AUTH_CODE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_AUTH_CODE_URL) ||
  `https://phpstack-1046663-6238875.cloudwaysapps.com/auth/google`;

const ENDPOINTS = {
  register: `${BASE_URL}/api/auth/register`,
  login: `${BASE_URL}/api/auth/login`,
  forgotPassword: `${BASE_URL}/api/auth/forgot-password`,
  resetPassword: `${BASE_URL}/api/auth/reset-password`,
  google: GOOGLE_LOGIN_URL,
  googleAuthCode: GOOGLE_AUTH_CODE_URL,
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
  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    accessToken?: string;
    access_token?: string;
    [key: string]: unknown;
  };

  // Some backends return a token directly on register; persist it so the user is considered logged in.
  const token = data.token ?? data.accessToken ?? data.access_token;
  if (typeof token === 'string' && token.length > 0) {
    await saveToken(token);
  }

  return data;
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

export interface ForgotPasswordPayload {
  email: string;
  client?: 'mobile';
}

export interface ForgotPasswordResponse {
  ok: boolean;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface ResetPasswordResponse {
  ok: boolean;
}

async function readErrorMessage(res: Response): Promise<string> {
  const json = (await res.json().catch(() => null)) as null | { message?: unknown };
  const msg = json && typeof json.message === 'string' ? json.message : '';
  if (msg) return msg;
  const text = await res.text().catch(() => '');
  return text || `API error: ${res.status} ${res.statusText}`;
}

export interface GoogleLoginResponse {
  token?: string;
  user?: { id?: string; email?: string; name?: string; phone?: string; role?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface GoogleAuthCodePayload {
  code: string;
  redirectUri: string;
}

/**
 * POST /auth/google – Expo auth-code flow
 * Body: { code, redirectUri }
 * Returns: { user, token } (token is saved locally via storagetank).
 */
export async function googleAuthCodeLogin(payload: GoogleAuthCodePayload): Promise<GoogleLoginResponse> {
  const code = String(payload.code ?? '').trim();
  const redirectUri = String(payload.redirectUri ?? '').trim();
  if (!code || !redirectUri) throw new Error('Google sign-in failed. Missing authorization code.');

  const res = await fetch(ENDPOINTS.googleAuthCode, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
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

export interface GoogleSocialLoginPayload {
  email: string;
  name: string;
  provider_id: string;
  avatar?: string | null;
}

/**
 * POST /api/auth/google – Google social login (signup + login)
 * Body: { email, name, provider_id, avatar? }
 * Returns: { user, token } (token is saved locally via storagetank).
 */
export async function googleSocialLogin(payload: GoogleSocialLoginPayload): Promise<GoogleLoginResponse> {
  const email = String(payload.email ?? '').trim().toLowerCase();
  const name = String(payload.name ?? '').trim();
  const provider_id = String(payload.provider_id ?? '').trim();
  const avatar = payload.avatar ? String(payload.avatar).trim() : undefined;

  if (!email || !name || !provider_id) {
    throw new Error('Google sign-in failed. Missing required profile fields.');
  }

  const res = await fetch(ENDPOINTS.google, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      name,
      provider_id,
      avatar: avatar || undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Google social login failed: ${res.status} ${res.statusText}`);
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
 * POST /api/auth/forgot-password – request reset email (generic response)
 * Body: { email, client: "mobile" }
 * Returns: { ok: true } (always generic even for unknown email)
 */
export async function forgotPassword(payload: ForgotPasswordPayload): Promise<ForgotPasswordResponse> {
  const email = String(payload.email ?? '').trim().toLowerCase();
  if (!email) throw new Error('Email is required.');
  const res = await fetch(ENDPOINTS.forgotPassword, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, client: payload.client ?? 'mobile' }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = (await res.json().catch(() => ({}))) as Partial<ForgotPasswordResponse>;
  return { ok: Boolean(data.ok ?? true) };
}

/**
 * POST /api/auth/reset-password – reset using token
 * Body: { token, password }
 * Returns: { ok: true }
 */
export async function resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResponse> {
  const token = String(payload.token ?? '').trim();
  const password = String(payload.password ?? '');
  if (!token) throw new Error('Reset token required');
  if (!password) throw new Error('Password is required.');
  const res = await fetch(ENDPOINTS.resetPassword, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = (await res.json().catch(() => ({}))) as Partial<ResetPasswordResponse>;
  return { ok: Boolean(data.ok ?? true) };
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
