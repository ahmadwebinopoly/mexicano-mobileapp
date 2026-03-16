/**
 * Orders API – place order
 * Base URL: EXPO_PUBLIC_API_BASE_URL or app.config.js extra.apiBaseUrl
 */

import { getToken } from '../storagetank';
import { getApiBaseUrl } from './apiConfig';

function parseErrorMessage(raw: string, status: number): string {
  const trimmed = raw?.trim() || '';
  if (!trimmed) return `Order failed (${status}). Please try again.`;
  // Strip HTML and extract <pre> content if present
  const preMatch = trimmed.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (preMatch) {
    const inner = preMatch[1].trim();
    if (inner.includes('Cannot POST')) {
      return 'Order service is not available. Please contact the restaurant or try again later.';
    }
    return inner;
  }
  // Remove HTML tags
  const noHtml = trimmed.replace(/<[^>]+>/g, '').trim();
  if (noHtml) return noHtml;
  return `Order failed (${status}). Please try again.`;
}

const ORDERS_URL = `${getApiBaseUrl()}/api/orders`;

export interface PlaceOrderPayload {
  customer: string;
  items: string;
  type: 'Delivery' | 'Pickup';
  amount: string;
  address: string;
  phone: string;
  notes?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentId?: string;
}

export interface PlaceOrderResponse {
  ok?: boolean;
  id?: string;
  orderId?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * POST /api/orders – place order (auth required)
 */
export async function placeOrder(payload: PlaceOrderPayload): Promise<PlaceOrderResponse> {
  const token = await getToken();
  if (!token) {
    throw new Error('You must be logged in to place an order.');
  }

  const res = await fetch(ORDERS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    const message = parseErrorMessage(text, res.status);
    throw new Error(message);
  }

  return res.json().catch(() => ({}));
}
