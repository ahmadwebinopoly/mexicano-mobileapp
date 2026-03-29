/**
 * Promotions / banners API
 * GET {API_BASE_URL}/api/promotions
 *
 * Uses getApiBaseUrl() so dev, preview APK, and production builds all hit the same
 * configured backend (EXPO_PUBLIC_API_BASE_URL or app.config.js extra.apiBaseUrl).
 *
 * Expected response (example):
 * [
 *   { id, title, desc, active, start, end, image: "data:image/jpeg;base64;..." }
 * ]
 */

import { getApiBaseUrl } from './apiConfig';

function promotionsUrl() {
  return `${getApiBaseUrl().replace(/\/+$/, '')}/api/promotions`;
}

/**
 * Fetch promotions and map them to items that can be used as banners.
 * Returns the raw promotions objects (with `image` as data-uri string).
 */
export async function getPromotionsBanners() {
  const res = await fetch(promotionsUrl(), { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to load promotions: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}
