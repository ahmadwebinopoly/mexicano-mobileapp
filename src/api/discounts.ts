/**
 * Discount codes — preview before place order
 * POST /api/discounts/apply
 */

import { getToken } from '../storagetank';
import { getApiBaseUrl } from './apiConfig';

function baseUrl(): string {
  return `${getApiBaseUrl().replace(/\/+$/, '')}/api/discounts`;
}

export interface ApplyDiscountPayload {
  code: string;
  /** Numeric subtotal as string, e.g. "14.50" */
  subtotal: string;
  /** ISO currency, e.g. gbp */
  currency: string;
  customerId?: string;
}

export interface ApplyDiscountResult {
  valid: boolean;
  discountType?: string;
  value?: number;
  discountAmount: number;
  finalAmount: number;
  raw?: Record<string, unknown>;
}

function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).replace(/[$,]/g, '').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * POST /api/discounts/apply — validate code and return discount preview.
 */
export async function applyDiscount(payload: ApplyDiscountPayload): Promise<ApplyDiscountResult> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const body: Record<string, unknown> = {
    code: payload.code.trim(),
    subtotal: payload.subtotal,
    currency: payload.currency,
  };
  if (payload.customerId?.trim()) {
    body.customerId = payload.customerId.trim();
  }

  const res = await fetch(`${baseUrl()}/apply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (!res.ok) throw new Error(text.slice(0, 200));
      throw new Error('Invalid response from discount service');
    }
  }

  if (!res.ok) {
    const msg =
      (typeof json.message === 'string' && json.message.trim()) ||
      (typeof json.error === 'string' && json.error.trim()) ||
      text.trim() ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  const valid = json.valid === true;
  if (!valid) {
    const msg =
      (typeof json.message === 'string' && json.message) ||
      (typeof json.error === 'string' && json.error) ||
      'This discount code cannot be applied.';
    throw new Error(msg);
  }

  const discountAmount = parseMoney(json.discountAmount) ?? 0;
  const finalAmount = parseMoney(json.finalAmount);
  const subtotalNum = parseMoney(payload.subtotal) ?? 0;

  const final =
    finalAmount != null
      ? finalAmount
      : Math.max(0, subtotalNum - discountAmount);

  return {
    valid: true,
    discountType: typeof json.discountType === 'string' ? json.discountType : undefined,
    value: typeof json.value === 'number' ? json.value : undefined,
    discountAmount,
    finalAmount: final,
    raw: json,
  };
}
