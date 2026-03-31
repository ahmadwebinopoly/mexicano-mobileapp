/**
 * DiscoverScreen API – menu items and categories
 * Base URL: EXPO_PUBLIC_API_BASE_URL or app.config.js extra.apiBaseUrl
 */

import { getApiBaseUrl } from './apiConfig';

const BASE_URL = getApiBaseUrl();
const ENDPOINTS = {
  menuItems: `${BASE_URL}/api/menu/items`,
  menuCategories: `${BASE_URL}/api/menu/categories`,
} as const;

export interface MenuCategory {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: string;
  image?: string | { uri: string };
  categoryId?: string;
  [key: string]: unknown;
}

export interface MenuItemsResponse {
  data?: MenuItem[];
  items?: MenuItem[];
  [key: string]: unknown;
}

export interface MenuCategoriesResponse {
  data?: MenuCategory[];
  categories?: MenuCategory[];
  [key: string]: unknown;
}

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

const MENU_CACHE_TTL_MS = 5 * 60 * 1000;
let menuItemsCache: MenuItem[] | null = null;
let menuItemsCacheAt = 0;
let menuItemsInFlight: Promise<MenuItem[]> | null = null;

/**
 * GET /api/menu/items
 */
export async function getMenuItems(): Promise<MenuItem[]> {
  const now = Date.now();
  if (menuItemsCache && now - menuItemsCacheAt < MENU_CACHE_TTL_MS) {
    return menuItemsCache;
  }
  if (menuItemsInFlight) return menuItemsInFlight;

  menuItemsInFlight = (async () => {
    const json = await request<MenuItemsResponse>(ENDPOINTS.menuItems);
    const list = (json.data ?? json.items ?? json) as MenuItem[] | undefined;
    const resolved = Array.isArray(list) ? list : [];
    menuItemsCache = resolved;
    menuItemsCacheAt = Date.now();
    return resolved;
  })();

  try {
    return await menuItemsInFlight;
  } finally {
    menuItemsInFlight = null;
  }
}

/**
 * GET /api/menu/categories
 */
export async function getMenuCategories(): Promise<MenuCategory[]> {
  const json = await request<MenuCategoriesResponse>(ENDPOINTS.menuCategories);
  const list = (json.data ?? json.categories ?? json) as MenuCategory[] | undefined;
  return Array.isArray(list) ? list : [];
}

export interface DiscoverBanner {
  id: string;
  imageUrl: string;
}

/**
 * GET /api/menu/banners (placeholder)
 *
 * You said you'll provide the real API details later.
 * For now, this returns an empty list so Discover falls back to the local Slider.png.
 */
export async function getDiscoverBanners(): Promise<DiscoverBanner[]> {
  // TODO: replace with the real banners endpoint when you share it.
  return [];
}

/** Order summary string parser (same format as checkout `items` payload) — used by order tracker modal & order details. */
export { parseOrderItemLines, type ParsedOrderLine } from '../utils/orderItemsSummary';
