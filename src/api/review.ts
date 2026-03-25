/**
 * Reviews API (Rate Your Feast)
 * Base: `{API_BASE_URL}/api/reviews`
 *
 * Aligns with backend: public summary + list; authenticated create/upsert, me, by order; admin helpers.
 */

import { getToken } from '../storagetank';
import { getApiBaseUrl } from './apiConfig';

function baseUrl(): string {
  return `${getApiBaseUrl().replace(/\/+$/, '')}/api/reviews`;
}

function messageFromErrorBody(text: string, status: number): string {
  const raw = text.trim();
  if (!raw) return `Request failed (${status})`;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const msg = j?.message ?? j?.error;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    if (j?.errors && typeof j.errors === 'object' && j.errors !== null) {
      const first = Object.values(j.errors as Record<string, unknown[]>)[0];
      if (Array.isArray(first) && first[0] != null) return String(first[0]);
    }
    return raw;
  } catch {
    return raw;
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  return messageFromErrorBody(text, res.status);
}

/** Some APIs return HTTP 200 with `{ success: false, message: "..." }` instead of 4xx. */
function throwIfSuccessEnvelopeFalse(text: string, httpStatus: number): void {
  const t = text.trim();
  if (!t) return;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(t) as Record<string, unknown>;
  } catch {
    return;
  }
  if (j.success === false) {
    const msg =
      (typeof j.message === 'string' && j.message.trim()) ||
      (typeof j.error === 'string' && j.error.trim()) ||
      `Request failed (${httpStatus})`;
    throw new Error(msg);
  }
}

/** Many backends return 200/201 with empty body, plain text, or `{ data: Review }`. */
function parseReviewFromSuccessBody(text: string, fallback: { orderId: string; overallRating: number }): Review {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      id: '',
      orderId: fallback.orderId,
      overallRating: fallback.overallRating,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(trimmed.length > 180 ? `${trimmed.slice(0, 180)}…` : trimmed);
  }
  if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>;
    if (o.data && typeof o.data === 'object') {
      return o.data as Review;
    }
    if (o.review && typeof o.review === 'object') {
      return o.review as Review;
    }
  }
  return parsed as Review;
}

/** Published-only histogram (1–5 star counts). Shape may vary by backend. */
export type StarDistribution = Record<string, number>;

export interface ReviewsSummary {
  averageOverall: number;
  count: number;
  distribution: StarDistribution;
}

export type ReviewsSort = 'newest' | 'highest_rating';

export interface ListReviewsParams {
  page?: number;
  pageSize?: number;
  sort?: ReviewsSort;
  minRating?: number;
}

export interface Review {
  id: string;
  orderId: string;
  userId?: string;
  overallRating: number;
  foodQualityRating?: number;
  servicesRating?: number;
  tags?: string[];
  comment?: string;
  photoUrls?: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubmitReviewPayload {
  orderId: string;
  overallRating: number;
  foodQualityRating?: number;
  servicesRating?: number;
  tags?: string[];
  comment?: string;
  /** Max 5 entries (URLs or base64), per backend. */
  photoUrls?: string[];
}

export type ReviewModerationStatus = 'published' | 'pending' | 'rejected' | 'hidden';

export interface ListAdminReviewsParams {
  page?: number;
  pageSize?: number;
  status?: ReviewModerationStatus | string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

/**
 * GET /api/reviews/summary — public. Published reviews only.
 */
export async function getReviewsSummary(): Promise<ReviewsSummary> {
  const res = await fetch(`${baseUrl()}/summary`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ReviewsSummary;
}

/**
 * GET /api/reviews — public. Published only.
 */
export async function listReviews(params: ListReviewsParams = {}): Promise<{ reviews?: Review[]; data?: Review[] } & Record<string, unknown>> {
  const q = buildQuery({
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    minRating: params.minRating,
  });
  const res = await fetch(`${baseUrl()}${q}`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as { reviews?: Review[]; data?: Review[] } & Record<string, unknown>;
}

/**
 * POST /api/reviews — Bearer. Create or update (upsert). Order must be Delivered; customer must match user.
 */
export async function submitReview(payload: SubmitReviewPayload): Promise<Review> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const oid = String(payload.orderId ?? '').trim();
  if (!oid) {
    throw new Error('Missing order id — go back and open the review from your order list.');
  }

  /**
   * Send camelCase + snake_case (same pattern as `orders.ts` / `placeOrder`).
   * Many PHP/Node handlers only bind snake_case; missing columns can surface as 500 instead of 400.
   */
  const body: Record<string, unknown> = {
    orderId: oid,
    order_id: oid,
    overallRating: payload.overallRating,
    overall_rating: payload.overallRating,
  };

  if (payload.foodQualityRating != null && payload.foodQualityRating >= 1 && payload.foodQualityRating <= 5) {
    body.foodQualityRating = payload.foodQualityRating;
    body.food_quality_rating = payload.foodQualityRating;
  }
  if (payload.servicesRating != null && payload.servicesRating >= 1 && payload.servicesRating <= 5) {
    body.servicesRating = payload.servicesRating;
    body.services_rating = payload.servicesRating;
  }
  if (payload.tags && payload.tags.length > 0) {
    body.tags = payload.tags;
  }
  const trimmed = payload.comment?.trim();
  if (trimmed) {
    const c = trimmed.slice(0, 2000);
    body.comment = c;
  }
  if (payload.photoUrls && payload.photoUrls.length > 0) {
    const urls = payload.photoUrls.slice(0, 5);
    body.photoUrls = urls;
    body.photo_urls = urls;
  }

  const res = await fetch(baseUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();

  if (!res.ok) {
    throw new Error(messageFromErrorBody(responseText, res.status));
  }

  throwIfSuccessEnvelopeFalse(responseText, res.status);

  return parseReviewFromSuccessBody(responseText, { orderId: oid, overallRating: payload.overallRating });
}

/**
 * GET /api/reviews/me — current user’s reviews.
 */
export async function getMyReviews(): Promise<Review[]> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  const res = await fetch(`${baseUrl()}/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  const data = (await res.json()) as Review[] | { reviews?: Review[]; data?: Review[] };
  if (Array.isArray(data)) return data;
  return data.reviews ?? data.data ?? [];
}

/**
 * GET /api/reviews/order/:orderId — review for one order (owner or admin).
 */
export async function getReviewByOrderId(orderId: string): Promise<Review | null> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  const id = encodeURIComponent(String(orderId));
  const res = await fetch(`${baseUrl()}/order/${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as Review;
}

/**
 * GET /api/reviews/admin — all reviews + order snapshot (admin token).
 */
export async function listReviewsAdmin(params: ListAdminReviewsParams = {}): Promise<unknown> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  const q = buildQuery({
    page: params.page,
    pageSize: params.pageSize,
    status: params.status,
  });
  const res = await fetch(`${baseUrl()}/admin${q}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

/**
 * PATCH /api/reviews/:id/status — moderation.
 */
export async function patchReviewStatus(
  reviewId: string,
  status: ReviewModerationStatus
): Promise<Review> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  const id = encodeURIComponent(String(reviewId));
  const res = await fetch(`${baseUrl()}/${id}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as Review;
}
