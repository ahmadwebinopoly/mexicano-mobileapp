/**
 * Menu API – menu items and categories for MenuScreen
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
  rating?: string;
  time?: string;
  /** Cooking/prep time – may come as cookingTime, cooking_time, prepTime, preparationTime, or time (string or number in minutes) */
  cookingTime?: string | number;
  cooking_time?: string | number;
  prepTime?: string | number;
  preparationTime?: string | number;
  [key: string]: unknown;
}

export interface MenuItemsResponse {
  data?: MenuItem[] | { items?: MenuItem[]; [key: string]: unknown };
  items?: MenuItem[];
  menu?: MenuItem[];
  menuItems?: MenuItem[];
  result?: MenuItem[];
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

/** Fetch raw response text for preview/debug. */
export async function fetchMenuItemsRaw(): Promise<{ rawText: string; rawJson: unknown }> {
  const url = ENDPOINTS.menuItems;
  const res = await fetch(url);
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  let rawJson: unknown;
  try {
    rawJson = rawText ? JSON.parse(rawText) : null;
  } catch {
    rawJson = rawText;
  }
  return { rawText, rawJson };
}

function normalizeMenuItem(raw: unknown): MenuItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = o.id ?? o._id;
  const name = o.name ?? o.itemName ?? o.title;
  if (id == null || name == null) return null;
  return {
    id: String(id),
    name: String(name),
    description: o.description != null ? String(o.description) : undefined,
    price: o.price != null ? String(o.price) : '',
    image: (() => {
      const img = o.image;
      if (typeof img === 'string' && img.trim()) return img;
      if (img && typeof img === 'object' && (img as { uri?: string }).uri) return { uri: String((img as { uri: string }).uri) };
      return undefined;
    })(),
    categoryId: o.categoryId != null ? String(o.categoryId) : undefined,
    rating: o.rating != null ? String(o.rating) : undefined,
    time: o.time != null ? String(o.time) : undefined,
    cookingTime: o.cookingTime,
    cooking_time: o.cooking_time,
    prepTime: o.prepTime,
    preparationTime: o.preparationTime,
    ...o,
  } as MenuItem;
}

let cachedMenuItems: MenuItem[] | null = null;

/** Return last successfully fetched menu items for instant display (e.g. when reopening Menu screen). */
export function getCachedMenuItems(): MenuItem[] | null {
  return cachedMenuItems;
}

/**
 * GET /api/menu/items – supports multiple response shapes and normalizes each item (id/_id, name/itemName/title, cooking time fields).
 * Use getMenuItemsWithResponse() when you need the raw response for preview.
 * Results are cached so subsequent calls (e.g. MenuScreen remount) can show data immediately.
 */
export async function getMenuItems(): Promise<MenuItem[]> {
  const json = await request<MenuItemsResponse>(ENDPOINTS.menuItems);
  const items = extractMenuItemsFromJson(json);
  cachedMenuItems = items;
  return items;
}

function extractMenuItemsFromJson(json: MenuItemsResponse): MenuItem[] {
  let list: unknown[] | undefined;
  if (Array.isArray(json)) {
    list = json;
  } else if (Array.isArray(json.data)) {
    list = json.data;
  } else if (Array.isArray(json.items)) {
    list = json.items;
  } else if (Array.isArray(json.menu)) {
    list = json.menu;
  } else if (Array.isArray(json.menuItems)) {
    list = json.menuItems;
  } else if (Array.isArray(json.result)) {
    list = json.result;
  } else if (json.data && typeof json.data === 'object' && Array.isArray((json.data as Record<string, unknown>).items)) {
    list = (json.data as Record<string, unknown>).items as unknown[];
  } else {
    list = [];
  }
  const out: MenuItem[] = [];
  for (const item of list) {
    const normalized = normalizeMenuItem(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

/** Returns normalized items and raw API response for preview/response display. */
export async function getMenuItemsWithResponse(): Promise<{
  items: MenuItem[];
  rawResponseText: string;
  rawResponseJson: unknown;
}> {
  const { rawText, rawJson } = await fetchMenuItemsRaw();
  const json = (rawJson ?? {}) as MenuItemsResponse;
  const items = extractMenuItemsFromJson(json);
  return { items, rawResponseText: rawText, rawResponseJson: rawJson };
}

/**
 * GET /api/menu/categories
 */
export async function getMenuCategories(): Promise<MenuCategory[]> {
  const json = await request<MenuCategoriesResponse>(ENDPOINTS.menuCategories);
  const list = (json.data ?? json.categories ?? json) as MenuCategory[] | undefined;
  return Array.isArray(list) ? list : [];
}
