/**
 * Orders API – fetch user orders, place new order
 * Base URL: EXPO_PUBLIC_API_BASE_URL or app.config.js extra.apiBaseUrl
 */

import { getToken } from '../storagetank';
import { getApiBaseUrl } from './apiConfig';

const BASE_URL = getApiBaseUrl();
const ENDPOINTS = {
  myOrders: `${BASE_URL}/api/orders/my`,
  currentOrders: `${BASE_URL}/api/orders/my/current`,
  historyOrders: `${BASE_URL}/api/orders/my/history`,
  placeOrder: `${BASE_URL}/api/orders`,
} as const;

export interface Order {
  id: string;
  customer: string;
  items: string;
  type: 'Delivery' | 'Pickup' | 'Dine In' | string;
  amount: string;
  status: 'Pending' | 'Preparing' | 'Ready' | 'Out for Delivery' | 'Delivered' | 'Cancelled' | string;
  date: string;
  createdAt: string;
  address?: string;
  phone?: string;
  notes?: string;
}

export interface MyOrdersResponse {
  current: Order[];
  history: Order[];
}

export interface OrdersListResponse {
  orders: Order[];
}

export interface PlaceOrderPayload {
  customer: string;
  items: string;
  type: 'Delivery' | 'Pickup' | 'Dine In';
  amount: string;
  address?: string;
  phone?: string;
  notes?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentId?: string;
}

/**
 * GET /api/orders/my – Get all user orders (current + history)
 */
export async function getMyOrders(): Promise<MyOrdersResponse> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(ENDPOINTS.myOrders, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return { current: [], history: [] };
    }
    let errorMsg = `Failed to fetch orders: ${res.status}`;
    try {
      const json = await res.json();
      if (json?.message?.toLowerCase().includes('not found')) {
        return { current: [], history: [] };
      }
      errorMsg = json?.message || errorMsg;
    } catch {
      const text = await res.text().catch(() => '');
      if (text) errorMsg = text;
    }
    throw new Error(errorMsg);
  }

  const data = (await res.json()) as MyOrdersResponse;
  return {
    current: data.current || [],
    history: data.history || [],
  };
}

/**
 * GET /api/orders/my/current – Get current orders only
 * Statuses: Pending, Preparing, Ready, Out for Delivery
 */
export async function getCurrentOrders(): Promise<Order[]> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(ENDPOINTS.currentOrders, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return [];
    }
    try {
      const json = await res.json();
      if (json?.message?.toLowerCase().includes('not found')) {
        return [];
      }
      throw new Error(json?.message || `Failed to fetch current orders: ${res.status}`);
    } catch (e) {
      if (e instanceof Error && e.message !== `Failed to fetch current orders: ${res.status}`) {
        throw e;
      }
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to fetch current orders: ${res.status}`);
    }
  }

  const data = (await res.json()) as OrdersListResponse;
  return data.orders || [];
}

/**
 * GET /api/orders/my/history – Get order history only
 * Statuses: Delivered, Cancelled
 */
export async function getHistoryOrders(): Promise<Order[]> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(ENDPOINTS.historyOrders, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return [];
    }
    try {
      const json = await res.json();
      if (json?.message?.toLowerCase().includes('not found')) {
        return [];
      }
      throw new Error(json?.message || `Failed to fetch order history: ${res.status}`);
    } catch (e) {
      if (e instanceof Error && e.message !== `Failed to fetch order history: ${res.status}`) {
        throw e;
      }
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to fetch order history: ${res.status}`);
    }
  }

  const data = (await res.json()) as OrdersListResponse;
  return data.orders || [];
}

/**
 * POST /api/orders – Place a new order
 */
export async function placeOrder(payload: PlaceOrderPayload): Promise<Order> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(ENDPOINTS.placeOrder, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to place order: ${res.status}`);
  }

  const data = (await res.json()) as Order;
  return data;
}

/**
 * Helper: Check if status is "current" (active order)
 */
export function isCurrentStatus(status: string): boolean {
  const currentStatuses = ['pending', 'preparing', 'ready', 'out for delivery'];
  return currentStatuses.includes(status.toLowerCase());
}

/**
 * Helper: Check if status is "history" (completed/cancelled)
 */
export function isHistoryStatus(status: string): boolean {
  const historyStatuses = ['delivered', 'cancelled'];
  return historyStatuses.includes(status.toLowerCase());
}

/**
 * Polling for real-time order updates
 */
type OrdersPollingCallback = (data: MyOrdersResponse) => void;
type OrdersPollingErrorCallback = (error: Error) => void;

let pollingIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start polling for order updates every `intervalMs` milliseconds (default: 2000ms)
 * @param onUpdate - Callback when new data is fetched
 * @param onError - Optional callback for errors
 * @param intervalMs - Polling interval in milliseconds (default: 2000)
 */
export function startOrdersPolling(
  onUpdate: OrdersPollingCallback,
  onError?: OrdersPollingErrorCallback,
  intervalMs: number = 2000,
): void {
  stopOrdersPolling();

  const poll = async () => {
    try {
      const data = await getMyOrders();
      onUpdate(data);
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  };

  void poll();
  pollingIntervalId = setInterval(poll, intervalMs);
}

/**
 * Stop polling for order updates
 */
export function stopOrdersPolling(): void {
  if (pollingIntervalId !== null) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
}

/**
 * Check if polling is currently active
 */
export function isOrdersPollingActive(): boolean {
  return pollingIntervalId !== null;
}
