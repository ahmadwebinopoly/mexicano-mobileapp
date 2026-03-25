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
  deliveryRadiusEnabled?: boolean;
  deliveryRadiusKm?: number;
}

export interface OrderModesResponse {
  orderModes?: OrderModes | Record<string, unknown>;
  data?: {
    orderModes?: OrderModes;
    delivery?: boolean;
    dining?: boolean;
    takeaway?: boolean;
    deliveryRadiusEnabled?: boolean;
    delivery_radius_enabled?: boolean;
    deliveryRadiusKm?: number | string;
    delivery_radius_km?: number | string;
    radiusKm?: number | string;
    radius_km?: number | string;
  };
  delivery?: boolean;
  dining?: boolean;
  takeaway?: boolean;
  deliveryRadiusEnabled?: boolean;
  delivery_radius_enabled?: boolean;
  deliveryRadiusKm?: number | string;
  delivery_radius_km?: number | string;
  radiusKm?: number | string;
  radius_km?: number | string;
  [key: string]: unknown;
}

const DEFAULT_ORDER_MODES: OrderModes = {
  delivery: true,
  dining: true,
  takeaway: true,
  deliveryRadiusEnabled: false,
  deliveryRadiusKm: 10,
};

function toBool(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string' && (value.toLowerCase() === 'true' || value === '1')) return true;
  return false;
}

function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function normalizeOrderModes(raw: OrderModesResponse | null): OrderModes {
  const modes = raw?.data?.orderModes ?? raw?.orderModes ?? raw;
  const envelope =
    (raw?.data && typeof raw.data === 'object' ? (raw.data as Record<string, unknown>) : {}) as Record<string, unknown>;
  if (!modes || typeof modes !== 'object') {
    return DEFAULT_ORDER_MODES;
  }
  const m = modes as Record<string, unknown>;
  const deliveryRadiusEnabled = toBool(
    m.deliveryRadiusEnabled ??
      m.delivery_radius_enabled ??
      envelope.deliveryRadiusEnabled ??
      envelope.delivery_radius_enabled
  );
  const deliveryRadiusKm =
    toPositiveNumber(
      m.deliveryRadiusKm ??
        m.delivery_radius_km ??
        m.radiusKm ??
        m.radius_km ??
        envelope.deliveryRadiusKm ??
        envelope.delivery_radius_km ??
        envelope.radiusKm ??
        envelope.radius_km
    ) ?? 10;
  return {
    delivery: toBool(m.delivery),
    dining: toBool(m.dining),
    takeaway: toBool(m.takeaway),
    deliveryRadiusEnabled,
    deliveryRadiusKm,
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
