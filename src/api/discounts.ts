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

function pickFirst(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in obj) return obj[key];
  }
  return undefined;
}

function pickFirstDeep(obj: Record<string, unknown>, keys: string[]): unknown {
  const direct = pickFirst(obj, keys);
  if (direct !== undefined) return direct;

  // Look one level deep (common shapes: { discount: {...} }, { payload: {...} }, etc.)
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const hit = pickFirst(v as Record<string, unknown>, keys);
      if (hit !== undefined) return hit;
    }
  }

  // Look two levels deep (common shapes: { data: { discount: {...} } })
  for (const v of Object.values(obj)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    for (const v2 of Object.values(v as Record<string, unknown>)) {
      if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
        const hit2 = pickFirst(v2 as Record<string, unknown>, keys);
        if (hit2 !== undefined) return hit2;
      }
    }
  }

  return undefined;
}

/** Flatten root + data + result so backend can put fields at any level. */
function mergeDiscountResponse(json: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...json };
  const data = json.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    Object.assign(merged, data as Record<string, unknown>);
  }
  const result = json.result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    Object.assign(merged, result as Record<string, unknown>);
  }
  return merged;
}

/**
 * POST /api/discounts/apply — validate code and return discount preview.
 */
export async function applyDiscount(payload: ApplyDiscountPayload): Promise<ApplyDiscountResult> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const code = payload.code.trim();
  const subtotal = payload.subtotal;
  const currencyRaw = String(payload.currency || '').trim();
  const currencyLower = currencyRaw.toLowerCase();
  const currencyUpper = currencyRaw.toUpperCase();
  const customerId = payload.customerId?.trim() ? payload.customerId.trim() : undefined;

  async function attempt(body: Record<string, unknown>) {
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
      const err = new Error(msg) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }

    return json;
  }

  function buildBody(currency?: string) {
    const body: Record<string, unknown> = { code, subtotal };
    if (customerId) body.customerId = customerId;
    if (currency && currency.trim()) {
      // Send multiple common key variants for compatibility.
      body.currency = currency;
      body.currency_code = currency;
      body.currencyCode = currency;
    }
    return body;
  }

  let json: Record<string, unknown>;
  try {
    json = await attempt(buildBody(currencyLower));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = (e as any)?.status;
    const isCurrencyConflict = status === 409 && /currency/i.test(msg);
    if (!isCurrencyConflict) throw e;

    // Retry 1: some backends validate against uppercase ISO codes (GBP/USD).
    try {
      json = await attempt(buildBody(currencyUpper));
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      const status2 = (e2 as any)?.status;
      const isCurrencyConflict2 = status2 === 409 && /currency/i.test(msg2);
      if (!isCurrencyConflict2) throw e2;

      // Retry 2: some stacks infer currency server-side; omit it to avoid false conflict.
      json = await attempt(buildBody(undefined));
    }
  }

  const merged = mergeDiscountResponse(json);

  const validRaw = pickFirstDeep(merged, ['valid', 'isValid', 'ok', 'success']);
  const statusRaw = pickFirstDeep(merged, ['status', 'state']);
  const statusOk =
    typeof statusRaw === 'string' && /^(success|ok|applied|valid)$/i.test(String(statusRaw).trim());

  const subtotalNum = parseMoney(payload.subtotal) ?? 0;

  let discountAmount =
    parseMoney(
      pickFirstDeep(merged, [
        'discountAmount',
        'discount_amount',
        'amountOff',
        'amount_off',
        'discount',
        'discountValue',
        'discount_value',
        'savings',
        'reduction',
        'totalDiscount',
        'total_discount',
      ])
    ) ?? 0;

  let finalAmount = parseMoney(
    pickFirstDeep(merged, [
      'finalAmount',
      'final_amount',
      'totalAfterDiscount',
      'total_after_discount',
      'newTotal',
      'new_total',
      'grandTotal',
      'grand_total',
      'totalAfter',
      'total_after',
      'discountedTotal',
      'discounted_total',
      'payable',
      'amountDue',
      'amount_due',
      'totalDue',
      'total_due',
      'final',
    ])
  );
  // Some APIs use "total" for the amount after discount; avoid using it when it equals subtotal with no discount parsed.
  if (finalAmount == null) {
    const totalRaw = parseMoney(pickFirstDeep(merged, ['total', 'orderTotal', 'order_total']));
    if (totalRaw != null && (discountAmount > 0.0005 || Math.abs(totalRaw - subtotalNum) > 0.0005)) {
      finalAmount = totalRaw;
    }
  }

  const value =
    parseMoney(
      pickFirstDeep(merged, ['value', 'discountValue', 'discount_value', 'percent', 'percentage', 'amount', 'amountOff'])
    ) ?? undefined;
  const discountTypeRaw = pickFirstDeep(merged, ['discountType', 'discount_type', 'type', 'mode', 'kind']);

  const discountType =
    typeof discountTypeRaw === 'string'
      ? String(discountTypeRaw).trim()
      : discountTypeRaw == null
        ? ''
        : String(discountTypeRaw);

  const typeLooksPercent = /percent|percentage|pct/i.test(discountType);
  const typeLooksFixed = /fixed|amount|flat|cash/i.test(discountType);

  const hasExplicitValid =
    validRaw === true || validRaw === 1 || validRaw === 'true' || validRaw === '1';
  const hasImplicitSuccess =
    discountAmount > 0.0005 ||
    (finalAmount != null && Math.abs(finalAmount - subtotalNum) > 0.0005) ||
    statusOk;

  const valid = hasExplicitValid || hasImplicitSuccess;

  if (!valid) {
    const msg =
      (typeof pickFirstDeep(merged, ['message', 'error']) === 'string' &&
        String(pickFirstDeep(merged, ['message', 'error']))) ||
      (typeof json.message === 'string' && json.message) ||
      (typeof json.error === 'string' && json.error) ||
      'This discount code cannot be applied.';
    throw new Error(msg);
  }

  // Fallback: some backends only return { type, value } but not computed amounts.
  const needsCompute =
    (finalAmount == null && discountAmount <= 0.0005) ||
    (finalAmount != null && Math.abs(finalAmount - subtotalNum) <= 0.0005 && discountAmount <= 0.0005);
  if (needsCompute && value != null && value > 0) {
    let computed = 0;
    if (typeLooksPercent || (!typeLooksFixed && value > 0 && value <= 100 && value % 1 === 0)) {
      computed = (subtotalNum * value) / 100;
    } else {
      computed = value;
    }
    if (computed > 0) {
      discountAmount = computed;
      finalAmount = Math.max(0, subtotalNum - computed);
    }
  }

  const final = finalAmount != null ? finalAmount : Math.max(0, subtotalNum - discountAmount);

  return {
    valid: true,
    discountType: discountType ? discountType : undefined,
    value,
    discountAmount,
    finalAmount: final,
    raw: json,
  };
}
