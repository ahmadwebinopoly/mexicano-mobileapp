/**
 * Delivery Address API – Mobile Integration
 * Base URL: EXPO_PUBLIC_API_BASE_URL or app.config.js extra.apiBaseUrl
 * All endpoints require Authorization: Bearer <token>
 */

import { getToken } from '../storagetank';
import { getApiBaseUrl } from './apiConfig';

const BASE_URL = getApiBaseUrl();
const ENDPOINTS = {
  address: `${BASE_URL}/api/user/address`,
  defaultAddress: `${BASE_URL}/api/user/address/default`,
  addressById: (id: string) => `${BASE_URL}/api/user/address/${id}`,
  setDefault: (id: string) => `${BASE_URL}/api/user/address/${id}/default`,
} as const;

export interface Address {
  id: string;
  userId?: string;
  latitude: number;
  longitude: number;
  address: string;
  customerLocation?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  floor?: string;
  homeNo?: string;
  isDefault?: boolean;
  createdAt?: string;
}

export interface SaveAddressPayload {
  latitude: number;
  longitude: number;
  address: string;
  customerLocation?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  floor?: string;
  homeNo?: string;
  isDefault?: boolean;
}

export interface UpdateAddressPayload {
  latitude?: number;
  longitude?: number;
  address?: string;
  customerLocation?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  floor?: string;
  homeNo?: string;
  isDefault?: boolean;
}

/**
 * POST /api/user/address – Save a new address
 */
export async function saveAddress(payload: SaveAddressPayload): Promise<Address> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(ENDPOINTS.address, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to save address: ${res.status}`);
  }

  return (await res.json()) as Address;
}

/**
 * GET /api/user/address – Get all addresses
 */
export async function getAllAddresses(): Promise<Address[]> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(ENDPOINTS.address, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return [];
    }
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to fetch addresses: ${res.status}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) {
    return data as Address[];
  }
  return [];
}

/**
 * GET /api/user/address/default – Get default address
 */
export async function getDefaultAddress(): Promise<Address | null> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(ENDPOINTS.defaultAddress, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to fetch default address: ${res.status}`);
  }

  return (await res.json()) as Address;
}

/**
 * GET /api/user/address/:id – Get address by ID
 */
export async function getAddressById(id: string): Promise<Address | null> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(ENDPOINTS.addressById(id), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to fetch address: ${res.status}`);
  }

  return (await res.json()) as Address;
}

/**
 * PUT /api/user/address/:id – Update an address
 */
export async function updateAddress(id: string, payload: UpdateAddressPayload): Promise<Address> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(ENDPOINTS.addressById(id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to update address: ${res.status}`);
  }

  return (await res.json()) as Address;
}

/**
 * PUT /api/user/address/:id/default – Set address as default
 */
export async function setAddressAsDefault(id: string): Promise<Address> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(ENDPOINTS.setDefault(id), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to set default address: ${res.status}`);
  }

  return (await res.json()) as Address;
}

/**
 * DELETE /api/user/address/:id – Delete an address
 */
export async function deleteAddress(id: string): Promise<void> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(ENDPOINTS.addressById(id), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to delete address: ${res.status}`);
  }
}

// Legacy exports for backward compatibility
export type SaveAddressResponse = Address;
export const getAddress = getDefaultAddress;
