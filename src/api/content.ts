/**
 * Content API – brand story and other CMS content
 * Base URL: EXPO_PUBLIC_API_BASE_URL or app.config.js extra.apiBaseUrl
 */

import { getApiBaseUrl } from './apiConfig';

const BASE_URL = getApiBaseUrl();
const ENDPOINTS = {
  story: `${BASE_URL}/api/content/story`,
  contact: `${BASE_URL}/api/content/contact`,
  contactSubmit: `${BASE_URL}/api/content/contact/submit`,
  visit: `${BASE_URL}/api/content/visit`,
} as const;

const CONTENT_CACHE_TTL_MS = 5 * 60 * 1000;

let storyCache: string | null = null;
let storyCacheAt = 0;
let storyInFlight: Promise<string> | null = null;

let visitCache: VisitContent | null = null;
let visitCacheAt = 0;
let visitInFlight: Promise<VisitContent> | null = null;

export interface StoryResponse {
  content?: string;
  story?: string;
  data?: { content?: string; story?: string };
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
 * GET /api/content/story – returns the brand story text for read-only display
 */
export async function getStory(): Promise<string> {
  const now = Date.now();
  if (storyCache != null && now - storyCacheAt < CONTENT_CACHE_TTL_MS) {
    return storyCache;
  }
  if (storyInFlight) return storyInFlight;

  storyInFlight = (async () => {
    const json = await request<StoryResponse>(ENDPOINTS.story);
    const data = json.data ?? json;
    const text =
      (data && (typeof data === 'object' && ('content' in data ? data.content : data.story))) ??
      (typeof json.content === 'string' ? json.content : json.story);
    const resolved = typeof text === 'string' ? text : '';
    storyCache = resolved;
    storyCacheAt = Date.now();
    return resolved;
  })();

  try {
    return await storyInFlight;
  } finally {
    storyInFlight = null;
  }
}

export interface ContactResponse {
  phone?: string;
  email?: string;
  message?: string;
  phoneNumber?: string;
  emailAddress?: string;
  shortMessage?: string;
  title?: string;
  phone_number?: string;
  email_address?: string;
  short_message?: string;
  data?: Record<string, unknown>;
  content?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ContactContent {
  phoneNumber: string;
  emailAddress: string;
  shortMessage: string;
  title: string;
}

function pickString(obj: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

/**
 * GET /api/content/contact – returns contact details for display
 * API returns: { phone, email, message }. Also accepts camelCase/snake_case and data/content wrapper.
 */
export async function getContact(): Promise<ContactContent> {
  const json = await request<ContactResponse>(ENDPOINTS.contact);
  const raw = json as Record<string, unknown>;
  const data = (raw?.data ?? raw?.content ?? raw) as Record<string, unknown> | undefined;
  return {
    title: pickString(data, 'title') || 'Contact Details',
    phoneNumber: pickString(data, 'phone', 'phoneNumber', 'phone_number'),
    emailAddress: pickString(data, 'email', 'emailAddress', 'email_address'),
    shortMessage: pickString(data, 'message', 'shortMessage', 'short_message'),
  };
}

export interface ContactSubmitPayload {
  phone?: string;
  email?: string;
  message?: string;
}

/**
 * POST /api/content/contact/submit – submit contact form
 */
export async function submitContact(payload: ContactSubmitPayload): Promise<unknown> {
  const res = await fetch(ENDPOINTS.contactSubmit, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

export interface VisitLocation {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  mapsUrl?: string;
}

export interface VisitDayHours {
  open: string;
  close: string;
  isOpen: boolean;
}

export type VisitHours = Record<string, VisitDayHours>;

export interface VisitResponse {
  location?: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    mapsUrl?: string;
    map_url?: string;
  };
  hours?: Record<string, { open?: string; close?: string; isOpen?: boolean }>;
  data?: {
    location?: VisitResponse['location'];
    hours?: VisitResponse['hours'];
  };
  content?: {
    location?: VisitResponse['location'];
    hours?: VisitResponse['hours'];
  };
  [key: string]: unknown;
}

export interface VisitContent {
  location: VisitLocation | null;
  hours: VisitHours;
}

/**
 * GET /api/content/visit – store location and operating hours
 * API preview example:
 * {
 *   location: {
 *     name: \"Mexicano - best\",
 *     address: \"742 Salsa Street\",
 *     city: \"Austin\",
 *     state: \"TX\",
 *     zip: \"78702\",
 *     mapsUrl: \"https://maps.google.com/maps?q=742+Salsa+Street+Austin+TX&output=embed\"
 *   },
 *   hours: {
 *     Monday: { open: \"11:00\", close: \"22:00\", isOpen: true },
 *     ...
 *   }
 * }
 */
export async function getVisit(): Promise<VisitContent> {
  const now = Date.now();
  if (visitCache != null && now - visitCacheAt < CONTENT_CACHE_TTL_MS) {
    return visitCache;
  }
  if (visitInFlight) return visitInFlight;

  visitInFlight = (async () => {
    const json = await request<VisitResponse>(ENDPOINTS.visit);
    const raw = json as VisitResponse;
    const base = (raw.data ?? raw.content ?? raw) as VisitResponse;

    const loc = base.location ?? undefined;

    const location: VisitLocation | null = loc
      ? {
          name: pickString(loc as unknown as Record<string, unknown>, 'name'),
          address: pickString(loc as unknown as Record<string, unknown>, 'address'),
          city: pickString(loc as unknown as Record<string, unknown>, 'city'),
          state: pickString(loc as unknown as Record<string, unknown>, 'state'),
          zip: pickString(loc as unknown as Record<string, unknown>, 'zip'),
          mapsUrl:
            pickString(
              loc as unknown as Record<string, unknown>,
              'mapsUrl',
              'map_url',
            ) || undefined,
        }
      : null;

    const hoursRaw = (base.hours ?? {}) as Record<
      string,
      { open?: string; close?: string; isOpen?: boolean }
    >;

    const hours: VisitHours = {};
    for (const [day, value] of Object.entries(hoursRaw)) {
      if (!value) continue;
      const open = typeof value.open === 'string' ? value.open : '';
      const close = typeof value.close === 'string' ? value.close : '';
      const isOpen =
        typeof value.isOpen === 'boolean'
          ? value.isOpen
          : Boolean((value as unknown as Record<string, unknown>).open);
      hours[day] = { open, close, isOpen };
    }

    const resolved: VisitContent = { location, hours };
    visitCache = resolved;
    visitCacheAt = Date.now();
    return resolved;
  })();

  try {
    return await visitInFlight;
  } finally {
    visitInFlight = null;
  }
}
