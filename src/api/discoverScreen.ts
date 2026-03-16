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

/**
 * GET /api/menu/items
 */
export async function getMenuItems(): Promise<MenuItem[]> {
  const json = await request<MenuItemsResponse>(ENDPOINTS.menuItems);
  const list = (json.data ?? json.items ?? json) as MenuItem[] | undefined;
  return Array.isArray(list) ? list : [];
}

/**
 * GET /api/menu/categories
 */
export async function getMenuCategories(): Promise<MenuCategory[]> {
  const json = await request<MenuCategoriesResponse>(ENDPOINTS.menuCategories);
  const list = (json.data ?? json.categories ?? json) as MenuCategory[] | undefined;
  return Array.isArray(list) ? list : [];
}
