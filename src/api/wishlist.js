/**
 * Wishlist API
 * POST /api/wishlist
 * GET /api/wishlist
 * DELETE /api/wishlist/:productId
 *
 * All endpoints require auth:
 * Authorization: Bearer <token>
 */

import { getToken } from '../storagetank';
import { getApiBaseUrl } from './apiConfig';

function baseUrl() {
  return `${getApiBaseUrl()}/api/wishlist`;
}

function toErrorMessage(text) {
  if (typeof text === 'string' && text.trim()) return text.trim();
  return 'Request failed';
}

export async function addToWishlist(productId) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(baseUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId }),
  });

  const text = await res.text().catch(() => '');
  let json = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      // ignore JSON parse errors; fall back to raw text
    }
  }

  if (!res.ok) {
    throw new Error(json?.message || json?.error || toErrorMessage(text) || `Failed (${res.status})`);
  }

  return json;
}

/**
 * Add or remove one product — use when the UI already knows whether it is saved.
 * @param {number|string} productId
 * @param {boolean} isCurrentlySaved - if true, calls DELETE; if false, calls POST
 */
export async function toggleWishlistProduct(productId, isCurrentlySaved) {
  const id = typeof productId === 'number' ? productId : Number(productId);
  if (!Number.isFinite(id)) {
    throw new Error('Invalid product id');
  }
  if (isCurrentlySaved) {
    return removeFromWishlist(id);
  }
  return addToWishlist(id);
}

export async function getWishlist() {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(baseUrl(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const text = await res.text().catch(() => '');
  let json = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      // ignore
    }
  }

  if (!res.ok) {
    throw new Error(json?.message || json?.error || toErrorMessage(text) || `Failed (${res.status})`);
  }

  return json;
}

export async function removeFromWishlist(productId) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${baseUrl()}/${productId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text().catch(() => '');
  let json = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      // ignore
    }
  }

  if (!res.ok) {
    throw new Error(json?.message || json?.error || toErrorMessage(text) || `Failed (${res.status})`);
  }

  return json;
}

