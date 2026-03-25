# Reviews API (Rate Your Feast)

**Base URL:** `{API_BASE_URL}/api/reviews`

This document merges the **backend contract** with the **mobile client** implementation. The app submits reviews from **`RateYourFeastScreen.tsx`** via **`src/api/review.ts`** (TypeScript; same module the team may refer to as the “review API file”).

---

## Backend routes (reference)

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/reviews/summary` | `averageOverall`, `count`, `distribution` (1–5) — **published** only |
| `GET` | `/api/reviews` | Query: `page`, `pageSize`, `sort` (`newest` \| `highest_rating`), `minRating` — **published** only |

### Authenticated customer

| Method | Path | Headers | Description |
|--------|------|---------|-------------|
| `PATCH` | `/api/reviews` | `Authorization: Bearer` | Create or **update** review (upsert). Order must be **Delivered**; `order.customer` must match `user.name`. |
| `GET` | `/api/reviews/me` | Bearer | Current user’s reviews |
| `GET` | `/api/reviews/order/:orderId` | Bearer | Single review for order (owner or admin) |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/reviews/admin` | Query: `page`, `pageSize`, `status` — all reviews + order snapshot fields |
| `PATCH` | `/api/reviews/:id/status` | Body: `{ "status": "published" \| "pending" \| "rejected" \| "hidden" }` |

---

## PATCH body (JSON) — submit review

| Field | Required | Notes |
|--------|----------|--------|
| `orderId` | **Yes** | String |
| `overallRating` | **Yes** | Integer **1–5** |
| `foodQualityRating` | No | **1–5** |
| `servicesRating` | No | **1–5** |
| `tags` | No | Array; **whitelist only** (see below) |
| `comment` | No | Max **2000** characters |
| `photoUrls` | No | Array of strings (URLs or base64), **max 5** |

**Mobile behavior:** The app sends **`photoUrls` only when populated** (future: image picker). Optional star fields are omitted when the user leaves them at 0 (not selected).

---

## Tag whitelist (“What stood out?”)

Exact strings (English):

1. `Still Hot`
2. `Friendly Driver`
3. `Extra Salsa`
4. `Perfect Spices`
5. `Generous Portions`

---

## Mobile client — `src/api/review.ts`

Exported functions:

| Function | Maps to |
|----------|---------|
| `getReviewsSummary()` | `GET /api/reviews/summary` |
| `listReviews(params)` | `GET /api/reviews` |
| `submitReview(payload)` | `PATCH /api/reviews` |
| `getMyReviews()` | `GET /api/reviews/me` |
| `getReviewByOrderId(orderId)` | `GET /api/reviews/order/:orderId` |
| `listReviewsAdmin(params)` | `GET /api/reviews/admin` |
| `patchReviewStatus(id, status)` | `PATCH /api/reviews/:id/status` |

**Submit** is used by **`RateYourFeastScreen`**: on success, the user sees a thank-you alert and navigates back; on failure, **`getNetworkErrorMessage`** surfaces the server/body message.

Types exported include `SubmitReviewPayload`, `Review`, `ReviewsSummary`, `ListReviewsParams`, etc.

---

## Screen payload mapping (`RateYourFeastScreen.tsx`)

| UI state | PATCH field |
|----------|-------------|
| Route `orderId` | `orderId` |
| Overall stars | `overallRating` |
| Food Quality (if ≥ 1) | `foodQualityRating` |
| Services Rates (if ≥ 1) | `servicesRating` |
| Selected chips | `tags` |
| Comment text (trimmed) | `comment` |

Route params **`items`** / **`amount`** are **display only**; not sent on submit.

---

## Review resource (example response)

```json
{
  "id": "rev_uuid",
  "orderId": "abc-123",
  "userId": "user_uuid",
  "overallRating": 4,
  "foodQualityRating": 5,
  "servicesRating": 4,
  "tags": ["Still Hot", "Perfect Spices"],
  "comment": "The salsa was incredibly fresh...",
  "photoUrls": ["https://cdn.example.com/reviews/rev_uuid/1.jpg"],
  "status": "published",
  "createdAt": "2025-03-25T12:00:00.000Z",
  "updatedAt": "2025-03-25T12:00:00.000Z"
}
```

---

## Security notes

- Do not trust client-only display fields for authorization; validate order ownership and **Delivered** status server-side.
- Rate-limit `PATCH /api/reviews`.
- Sanitize `comment` for storefront HTML.

---

## UI details (detailed ratings)

Two rows in a card — **Food Quality** and **Services Rates** — five gold stars each (1–5), labels left and stars right-aligned, with a divider between rows.
