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
  orderType?: 'Delivery' | 'Pickup' | 'Dine In' | string;
  dishRating?: number;
  dishTag?: string;
  experience?: Record<string, number>;
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
  orderType: 'Delivery' | 'Pickup' | 'Dine In';
  dishRating: number;
  dishTag?: string;
  comment?: string;
  experience: {
    foodQuality: number;
    deliverySpeed?: number;
    pickupSpeed?: number;
    packaging?: number;
    staffService?: number;
    ambience?: number;
  };
}

export interface SubmitReviewResponse {
  success: boolean;
  message: string;
  reviewId?: string;
  errors?: string[];
}

export type ReviewModerationStatus = 'published' | 'pending' | 'rejected' | 'hidden';

export interface ListAdminReviewsParams {
  page?: number;
  pageSize?: number;
  status?: ReviewModerationStatus | string;
}

export interface AdminReviewRow {
  id: string;
  overallRating?: number;
  orderItemsSummary?: string;
  status?: string;
  [key: string]: unknown;
}

export interface AdminReviewsPageResponse {
  page: number;
  pageSize: number;
  total: number;
  reviews: AdminReviewRow[];
}

export interface ProductSummaryItem {
  count: number;
  averageOverall: number;
}

export interface ProductSummaryResponse {
  items: Record<string, ProductSummaryItem>;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

function isWholeRating(n: number | undefined): boolean {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;
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
export async function submitReview(payload: SubmitReviewPayload): Promise<SubmitReviewResponse> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const oid = String(payload.orderId ?? '').trim();
  if (!oid) {
    throw new Error('Missing order id — go back and open the review from your order list.');
  }

  const orderType = payload.orderType;
  if (orderType !== 'Delivery' && orderType !== 'Pickup' && orderType !== 'Dine In') {
    throw new Error('orderType must be Delivery, Pickup, or Dine In.');
  }
  if (!isWholeRating(payload.dishRating)) {
    throw new Error('dishRating must be a whole number between 1 and 5.');
  }
  if (!isWholeRating(payload.experience.foodQuality)) {
    throw new Error('experience.foodQuality must be a whole number between 1 and 5.');
  }

  if (orderType === 'Delivery') {
    if (!isWholeRating(payload.experience.deliverySpeed) || !isWholeRating(payload.experience.packaging)) {
      throw new Error('For Delivery, experience.deliverySpeed and experience.packaging are required (1..5).');
    }
  } else if (orderType === 'Pickup') {
    if (!isWholeRating(payload.experience.pickupSpeed) || !isWholeRating(payload.experience.packaging)) {
      throw new Error('For Pickup, experience.pickupSpeed and experience.packaging are required (1..5).');
    }
  } else {
    if (!isWholeRating(payload.experience.staffService) || !isWholeRating(payload.experience.ambience)) {
      throw new Error('For Dine In, experience.staffService and experience.ambience are required (1..5).');
    }
  }

  const body: Record<string, unknown> = {
    orderId: oid,
    orderType,
    dishRating: payload.dishRating,
    dishTag: payload.dishTag?.trim() || undefined,
    comment: payload.comment?.trim() || undefined,
    experience: payload.experience,
  };

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
  if (!responseText.trim()) {
    return { success: true, message: 'Review submitted successfully' };
  }
  const parsed = JSON.parse(responseText) as SubmitReviewResponse;
  if (parsed?.success === false) {
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      throw new Error(parsed.errors[0]);
    }
    throw new Error(parsed.message || 'Invalid review payload');
  }
  return parsed;
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
 * GET /api/reviews/admin page helper for product rating UI.
 * Tries public first, retries with Bearer if endpoint requires auth.
 */
export async function getReviewsAdminPage(
  page: number = 1,
  pageSize: number = 15
): Promise<AdminReviewsPageResponse> {
  const q = buildQuery({ page, pageSize });
  const url = `${baseUrl()}/admin${q}`;

  const first = await fetch(url, { method: 'GET' });
  if (first.ok) {
    return (await first.json()) as AdminReviewsPageResponse;
  }

  if (first.status === 401 || first.status === 403) {
    const token = await getToken();
    if (token) {
      const second = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!second.ok) {
        throw new Error(await readErrorMessage(second));
      }
      return (await second.json()) as AdminReviewsPageResponse;
    }
  }

  throw new Error(await readErrorMessage(first));
}

/**
 * GET /api/reviews/product-summary?ids=12,15,99
 * Public endpoint that returns count + averageOverall keyed by product id.
 */
export async function getProductReviewsSummary(ids: Array<string | number>): Promise<ProductSummaryResponse> {
  const uniqueIds = Array.from(
    new Set(
      ids
        .map((id) => String(id).trim())
        .filter(Boolean)
    )
  );
  if (uniqueIds.length === 0) {
    return { items: {} };
  }
  const q = new URLSearchParams();
  q.set('ids', uniqueIds.join(','));
  const url = `${baseUrl()}/product-summary?${q.toString()}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  const data = (await res.json()) as ProductSummaryResponse;
  const items = data?.items && typeof data.items === 'object' ? data.items : {};
  return { items };
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
