/**
 * ItemDetailScreen API – add-ons for menu item detail
 * Base URL: EXPO_PUBLIC_API_BASE_URL or app.config.js extra.apiBaseUrl
 */

import { getApiBaseUrl } from './apiConfig';

const BASE_URL = getApiBaseUrl();
const ENDPOINTS = {
  addons: `${BASE_URL}/api/menu/addons`,
  /** Linked add-ons for a menu item: GET /api/menu/addons?itemId=xxx */
  linkedAddons: (itemId: string) =>
    `${BASE_URL}/api/menu/addons?itemId=${encodeURIComponent(itemId)}`,
} as const;

export interface AddonItem {
  id: string;
  name: string;
  description?: string;
  price: string;
  image?: string | { uri: string };
  rating?: string;
  [key: string]: unknown;
}

export interface AddonsResponse {
  data?: AddonItem[];
  items?: AddonItem[];
  addons?: AddonItem[];
  [key: string]: unknown;
}

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function normalizeAddon(raw: unknown): AddonItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = o.id ?? o._id;
  const name = o.name ?? o.itemName ?? o.title;
  if (id == null || name == null) return null;
  const img = o.image;
  const image =
    typeof img === 'string' && img.trim()
      ? img.trim()
      : img && typeof img === 'object' && (img as { uri?: string }).uri
        ? { uri: String((img as { uri: string }).uri) }
        : undefined;
  return {
    id: String(id),
    name: String(name),
    description: o.description != null ? String(o.description) : undefined,
    price: o.price != null ? String(o.price) : '',
    image,
    rating: o.rating != null ? String(o.rating) : undefined,
    ...o,
  } as AddonItem;
}

function extractAddonsFromJson(json: AddonsResponse): AddonItem[] {
  let list: unknown[] | undefined;
  if (Array.isArray(json)) {
    list = json;
  } else if (Array.isArray(json.data)) {
    list = json.data;
  } else if (Array.isArray(json.items)) {
    list = json.items;
  } else if (Array.isArray(json.addons)) {
    list = json.addons;
  } else {
    list = [];
  }
  const out: AddonItem[] = [];
  for (const item of list) {
    const n = normalizeAddon(item);
    if (n) out.push(n);
  }
  return out;
}

/**
 * GET /api/menu/addons (all add-ons – prefer getLinkedAddons for item detail).
 */
export async function getAddons(): Promise<AddonItem[]> {
  const json = await request<AddonsResponse>(ENDPOINTS.addons);
  return extractAddonsFromJson(json);
}

/**
 * GET linked add-ons for a menu item only.
 * Uses ?itemId=xxx so the backend can return only add-ons linked to this item.
 * Backend should implement filtering; if it does not support itemId, returns [].
 */
export async function getLinkedAddons(itemId: string): Promise<AddonItem[]> {
  if (!itemId.trim()) return [];
  try {
    const url = ENDPOINTS.linkedAddons(itemId);
    const json = await request<AddonsResponse>(url);
    return extractAddonsFromJson(json);
  } catch {
    return [];
  }
}
