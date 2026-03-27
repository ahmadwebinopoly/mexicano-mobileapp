/**
 * Promotions / banners API
 * GET https://phpstack-1046663-6238875.cloudwaysapps.com/api/promotions
 *
 * Expected response (example):
 * [
 *   { id, title, desc, active, start, end, image: "data:image/jpeg;base64,..." }
 * ]
 */

const PROMOTIONS_URL = 'https://phpstack-1046663-6238875.cloudwaysapps.com/api/promotions';

/**
 * Fetch promotions and map them to items that can be used as banners.
 * Returns the raw promotions objects (with `image` as data-uri string).
 */
export async function getPromotionsBanners() {
  const res = await fetch(PROMOTIONS_URL, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to load promotions: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

