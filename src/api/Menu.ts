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

/** Pick image from any common API shape (spread `...o` used to overwrite `image` with null). */
function coalesceMenuImage(o: Record<string, unknown>): string | { uri: string } | undefined {
  const img =
    o.image ??
    o.imageUrl ??
    o.image_url ??
    o.photo ??
    o.thumbnail ??
    o.thumbnailUrl ??
    o.picture ??
    o.img ??
    o.coverImage;
  if (typeof img === 'string' && img.trim()) return img.trim();
  if (img && typeof img === 'object' && (img as { uri?: string }).uri) {
    return { uri: String((img as { uri: string }).uri) };
  }
  return undefined;
}

function normalizeMenuItem(raw: unknown): MenuItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = o.id ?? o._id;
  const name = o.name ?? o.itemName ?? o.title;
  if (id == null || name == null) return null;
  return {
    ...o,
    id: String(id),
    name: String(name),
    description: o.description != null ? String(o.description) : undefined,
    price: o.price != null ? String(o.price) : '',
    image: coalesceMenuImage(o),
    categoryId: o.categoryId != null ? String(o.categoryId) : undefined,
    rating: o.rating != null ? String(o.rating) : undefined,
    time: o.time != null ? String(o.time) : undefined,
    cookingTime: o.cookingTime,
    cooking_time: o.cooking_time,
    prepTime: o.prepTime,
    preparationTime: o.preparationTime,
  } as MenuItem;
}

/** Absolute or relative image URL for use with `Image` + `normalizeImageUri`. */
export function getMenuItemImageUrlString(item: MenuItem): string | null {
  const resolved = coalesceMenuImage(item as Record<string, unknown>);
  if (typeof resolved === 'string' && resolved.trim()) return resolved.trim();
  if (resolved && typeof resolved === 'object' && 'uri' in resolved) {
    const u = String((resolved as { uri: string }).uri).trim();
    return u || null;
  }
  return null;
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
  const j = json as Record<string, unknown> | unknown[] | null;
  let list: unknown[] | undefined;
  if (Array.isArray(j)) {
    list = j;
  } else if (j && typeof j === 'object') {
    const o = j as Record<string, unknown>;
    const data = o.data;
    if (Array.isArray(o.items)) list = o.items;
    else if (Array.isArray(o.menu)) list = o.menu;
    else if (Array.isArray(o.menuItems)) list = o.menuItems;
    else if (Array.isArray(o.result)) list = o.result;
    else if (Array.isArray(data)) list = data;
    else if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.items)) list = d.items;
      else if (Array.isArray(d.menu)) list = d.menu;
      else if (Array.isArray(d.results)) list = d.results;
    }
    if (!list && o.result && typeof o.result === 'object') {
      const r = o.result as Record<string, unknown>;
      if (Array.isArray(r.items)) list = r.items;
    }
  }
  if (!list) {
    list = [];
  }
  const out: MenuItem[] = [];
  for (const item of list) {
    const normalized = normalizeMenuItem(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

/** Parse any JSON shape returned by GET /api/menu/items (same as getMenuItems). */
export function parseMenuItemsFromApiJson(json: unknown): MenuItem[] {
  return extractMenuItemsFromJson(json as MenuItemsResponse);
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
