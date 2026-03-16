/**
 * Profile API – current user (`/api/auth/me`)
 * Uses auth token from storagetank.
 */

import { getToken, removeToken } from '../storagetank';
import { getApiBaseUrl } from './apiConfig';

const BASE_URL = getApiBaseUrl();
const ENDPOINTS = {
  me: `${BASE_URL}/api/auth/me`,
} as const;

export interface ProfileUser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role?: string;
  [key: string]: unknown;
}

export interface MeResponse {
  user?: ProfileUser;
  [key: string]: unknown;
}

/**
 * GET /api/auth/me
 * - Returns current user if token is valid
 * - Returns null if no token or token invalid/expired
 */
export async function getCurrentUser(): Promise<ProfileUser | null> {
  const token = await getToken();
  if (!token) return null;

  try {
    const res = await fetch(ENDPOINTS.me, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401 || res.status === 403) {
      // Token invalid/expired – clear it
      await removeToken();
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const json = (await res.json().catch(() => ({}))) as MeResponse | ProfileUser;
    const user =
      (json as MeResponse).user ??
      (json as unknown as ProfileUser);

    if (!user || !user.email) return null;
    return user;
  } catch {
    return null;
  }
}

