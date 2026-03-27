/**
 * Delete account API
 * DELETE /api/user/account
 *
 * Requires auth:
 * Authorization: Bearer <token>
 *
 * Response: { ok: true }
 */

import { getToken } from '../storagetank';
import { getApiBaseUrl } from './apiConfig';

function baseUrl() {
  return `${getApiBaseUrl()}/api/user/account`;
}

function toErrorMessage(text) {
  if (typeof text === 'string' && text.trim()) return text.trim();
  return 'Request failed';
}

export async function deleteAccount() {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(baseUrl(), {
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

