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
  /** Must match backend: Delivery, Pickup (takeaway), Dine In (dining in place). */
  type: 'Delivery' | 'Pickup' | 'Dine In';
  amount: string;
  address: string;
  /** Optional delivery coordinates (for Delivery orders). */
  latitude?: number;
  longitude?: number;
  phone: string;
  notes?: string;
  /** Optional promo / discount code (camelCase + snake_case sent in body). */
  discountCode?: string;
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

  // Build body explicitly: some stacks only persist snake_case; others read camelCase.
  // Do not send payment_id as "" — backends often treat empty id as "no card payment" and show COD.
  const {
    latitude,
    longitude,
    paymentMethod,
    paymentStatus,
    paymentId,
    discountCode,
    ...rest
  } = payload;

  const body: Record<string, unknown> = { ...rest };

  // Coordinates (support common key variants)
  if (typeof latitude === 'number' && Number.isFinite(latitude)) {
    body.latitude = latitude;
    body.lat = latitude;
    body.deliveryLatitude = latitude;
    body.delivery_latitude = latitude;
  }
  if (typeof longitude === 'number' && Number.isFinite(longitude)) {
    body.longitude = longitude;
    body.lng = longitude;
    body.deliveryLongitude = longitude;
    body.delivery_longitude = longitude;
  }

  const codeTrim = discountCode != null ? String(discountCode).trim() : '';
  if (codeTrim) {
    body.discountCode = codeTrim;
    body.discount_code = codeTrim;
  }

  if (paymentMethod != null && String(paymentMethod).trim() !== '') {
    const pm = String(paymentMethod).trim();
    body.paymentMethod = pm;
    body.payment_method = pm;
    // Compatibility aliases (some backends/admin portals read different keys)
    body.payMethod = pm;
    body.pay_method = pm;
    body.paymentMode = pm;
    body.payment_mode = pm;
    body.paymentType = pm;
    body.payment_type = pm;
    // Also send a normalized code (helps when backend expects 'stripe'/'cod')
    body.payment_method_code = pm.toLowerCase();
  }
  if (paymentStatus != null && String(paymentStatus).trim() !== '') {
    const ps = String(paymentStatus).trim();
    body.paymentStatus = ps;
    body.payment_status = ps;
    // Compatibility aliases
    body.payStatus = ps;
    body.pay_status = ps;
    body.paymentState = ps;
    body.payment_state = ps;
    body.payment_status_code = ps.toLowerCase();
  }
  const idTrim = paymentId != null ? String(paymentId).trim() : '';
  if (idTrim) {
    body.paymentId = idTrim;
    body.payment_id = idTrim;
    // Compatibility aliases
    body.transactionId = idTrim;
    body.transaction_id = idTrim;
    body.paymentIntentId = idTrim;
    body.payment_intent_id = idTrim;
  }

  const res = await fetch(ORDERS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    const message = parseErrorMessage(text, res.status);
    throw new Error(message);
  }

  return res.json().catch(() => ({}));
}
