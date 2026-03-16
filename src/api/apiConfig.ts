/**
 * Single source of truth for API base URL.
 * Used by all API modules so endpoints work in dev and in APK/production builds.
 *
 * Resolution order:
 * 1. EXPO_PUBLIC_API_BASE_URL (env, inlined at build time)
 * 2. expoConfig.extra.apiBaseUrl (app.config.js extra – defaults to production API)
 * 3. Production API fallback (same as web backend)
 */

import Constants from 'expo-constants';

const PRODUCTION_API_BASE_URL = 'https://phpstack-1046663-6238875.cloudwaysapps.com';

function fromEnv(): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const v = process.env?.EXPO_PUBLIC_API_BASE_URL;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function fromExtra(): string | undefined {
  const v = Constants.expoConfig?.extra?.apiBaseUrl;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * Base URL for all API requests. No trailing slash.
 */
export function getApiBaseUrl(): string {
  const url = fromEnv() ?? fromExtra() ?? PRODUCTION_API_BASE_URL;
  return url.replace(/\/+$/, '');
}

/**
 * User-friendly message when an API/network request fails (e.g. no connection, timeout).
 * Use this to show a clear "Network error" in the UI.
 */
export function getNetworkErrorMessage(error: unknown): string {
  if (error instanceof TypeError && error.message?.toLowerCase().includes('network')) {
    return 'Network error – check your connection and try again.';
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (/network request failed|failed to fetch|load failed/i.test(msg)) {
    return 'Network error – check your connection and try again.';
  }
  return msg || 'Something went wrong. Please try again.';
}
