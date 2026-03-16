/**
 * Single source of truth for API base URL.
 * Used by all API modules so endpoints work in dev and in APK/production builds.
 *
 * Resolution order:
 * 1. EXPO_PUBLIC_API_BASE_URL (env, inlined at build time)
 * 2. expoConfig.extra.apiBaseUrl (app.config.js extra)
 * 3. http://localhost:8080 (dev fallback)
 *
 * For APK testing: set EXPO_PUBLIC_API_BASE_URL in .env or EAS env to your backend URL
 * (e.g. https://your-api.cloudwaysapps.com). Do not rely on localhost on a real device.
 */

import Constants from 'expo-constants';

const DEV_FALLBACK = 'http://localhost:8080';

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
  return fromEnv() ?? fromExtra() ?? DEV_FALLBACK;
}
