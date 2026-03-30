## Review API — dynamic per-item comments & photos (Mobile -> Backend)

This spec is based on the current mobile implementation:
- `MexicanoApp/src/screens/main/RateYourFeastScreen.tsx`
- `MexicanoApp/src/api/review.ts`

The goal is to let the backend support **per-dish** comments and **per-dish** photos (optional), instead of the mobile app having to flatten everything into one `comment` string / one `photoUrls` array.

---

## Current mobile behavior (today)

### What the UI collects

**Experience ratings (required)**
- Delivery mode: `foodQuality`, `deliverySpeed`, `packaging`
- Dining mode: `foodQuality`, `staffService`, `ambience`
- Pickup mode: `foodQuality`, `pickupSpeed`, `packaging`

**Per dish line (required/optional)**
- **Required**: star rating (1..5)
- **Optional**: tag selection (multi-select) — currently flattened across all items
- **Optional**: per-item comment (user can expand/collapse)
- **Optional**: per-item photos (user can add multiple; with remove X)

### What the app sends now (`POST /api/reviews`)

Mobile calls `submitReview(payload)` with:

- **Required**
  - `orderId: string`
  - `orderType: 'Delivery' | 'Pickup' | 'Dine In'`
  - `dishRating: number` (computed aggregate from per-line ratings)
  - `experience: object` (mode-specific keys, all required within the mode)

- **Optional**
  - `dishTag?: string` (all selected tags across all lines joined by `, `)
  - `comment?: string` (per-item comments are flattened into a single string, each line like `ItemName: comment`)
  - `photoUrls?: string[]` (flattened across all lines)

> Note: On mobile, selected photos are stored as `data:` URLs where possible (base64) and then posted as strings in `photoUrls`.
> If base64 conversion fails, the app falls back to sending the local URI string (not useful for backend). Backend should expect and accept **base64 data URLs**.

---

## Backend changes requested (make it dynamic)

### 1) Accept per-item reviews in the payload

Add a new optional field:

```json
{
  "itemsReview": [
    {
      "title": "Russian Salad",
      "quantity": 1,
      "rating": 5,
      "tags": ["Perfect Spice", "Flavorful"],
      "comment": "Loved it, fresh and light",
      "photos": ["data:image/jpeg;base64,...", "data:image/png;base64,..."]
    }
  ]
}
```

Recommended rules:
- `itemsReview` is optional, but **if present**, it should contain one object per dish line.
- `photos` is optional; can be `[]`.
- `comment` is optional; can be empty.
- `tags` is optional; can be `[]`.
- `rating` should be validated as whole number `1..5`.

### 2) Keep current top-level fields for backward compatibility

Mobile currently sends:
- `dishRating` (aggregate)
- `dishTag` (flattened string)
- `comment` (flattened string)
- `photoUrls` (flattened array)

Backend should continue accepting these fields so older builds still work.

### 3) Preferred way to handle photos

Because `photoUrls` naming suggests URLs but mobile sends **base64 data URLs**, backend should handle either:
- **Option A (quick)**: accept base64 `data:` URLs directly in `itemsReview[].photos` and/or `photoUrls` and store them (S3, Cloudinary, etc.) then return real URLs.
- **Option B (clean)**: add a dedicated upload endpoint and return URLs; then mobile would send only URLs in the review payload.

For now, mobile expects that posting base64 strings works.

---

## Suggested `POST /api/reviews` request shape (v2, backward compatible)

```json
{
  "orderId": "64",
  "orderType": "Delivery",
  "dishRating": 4,
  "dishTag": "Perfect Spice, Flavorful",
  "comment": "Russian Salad: Loved it",
  "photoUrls": ["data:image/jpeg;base64,..."],
  "experience": {
    "foodQuality": 5,
    "deliverySpeed": 4,
    "packaging": 4
  },
  "itemsReview": [
    {
      "title": "Russian Salad",
      "quantity": 1,
      "rating": 5,
      "tags": ["Perfect Spice", "Flavorful"],
      "comment": "Loved it",
      "photos": ["data:image/jpeg;base64,..."]
    }
  ]
}
```

---

## Suggested response

Current mobile expects:

```json
{ "success": true, "message": "Review submitted successfully", "reviewId": "..." }
```

Keep this stable.

If backend stores uploaded photos and generates URLs, it can optionally include:

```json
{
  "success": true,
  "message": "Review submitted successfully",
  "reviewId": "...",
  "photoUrls": ["https://.../img1.jpg"],
  "itemsReview": [
    { "title": "Russian Salad", "photos": ["https://.../img1.jpg"] }
  ]
}
```

---

## Notes for backend team

- `order.items` parsing on mobile is based on `parseOrderItemLines()` in `src/utils/orderItemsSummary.ts`.
- Dish line identity on mobile is currently by **index** (line order) and `title` text.
- If you want strong identity, consider returning canonical `menuItemId` per line from orders so mobile can send `itemId` instead of `title`.

