/**
 * Order modes API – which service options are enabled (delivery, dining, takeaway)
 * GET /api/settings/order-modes/public
 * Base URL: EXPO_PUBLIC_API_BASE_URL or app.config.js extra.apiBaseUrl
 */

import { getApiBaseUrl } from './apiConfig';

const ORDER_MODES_URL = `${getApiBaseUrl()}/api/settings/order-modes/public`;

export interface OrderModes {
  delivery: boolean;
  dining: boolean;
  takeaway: boolean;
}

export interface OrderModesResponse {
  orderModes?: OrderModes | Record<string, unknown>;
  data?: { orderModes?: OrderModes; delivery?: boolean; dining?: boolean; takeaway?: boolean };
  delivery?: boolean;
  dining?: boolean;
  takeaway?: boolean;
  [key: string]: unknown;
}

const DEFAULT_ORDER_MODES: OrderModes = {
  delivery: true,
  dining: true,
  takeaway: true,
};

function toBool(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string' && (value.toLowerCase() === 'true' || value === '1')) return true;
  return false;
}

function normalizeOrderModes(raw: OrderModesResponse | null): OrderModes {
  const modes = raw?.data?.orderModes ?? raw?.orderModes ?? raw;
  if (!modes || typeof modes !== 'object') {
    return DEFAULT_ORDER_MODES;
  }
  const m = modes as Record<string, unknown>;
  return {
    delivery: toBool(m.delivery),
    dining: toBool(m.dining),
    takeaway: toBool(m.takeaway),
  };
}

/**
 * GET /api/settings/order-modes/public
 * Returns which order modes are enabled. Falls back to all true if request fails.
 */
export async function getOrderModes(): Promise<OrderModes> {
  try {
    const res = await fetch(ORDER_MODES_URL, { method: 'GET' });
    if (!res.ok) {
      return DEFAULT_ORDER_MODES;
    }
    const raw = (await res.json().catch(() => null)) as OrderModesResponse | null;
    return normalizeOrderModes(raw);
  } catch {
    return DEFAULT_ORDER_MODES;
  }
}
