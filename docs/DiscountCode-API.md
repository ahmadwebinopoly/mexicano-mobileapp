# Discount Code API (Checkout / Place Order)

This doc is for the backend team to implement discount codes so the mobile app can:

1. Let a user enter a discount code in `CheckoutScreen`
2. Send that code to `POST /api/orders`
3. Have the backend validate the code, calculate the discount, and store the discounted order

Base URL is the existing API base used by the app: `GET/POST` routes under `{API_BASE_URL}`.

---

## 1) What the app sends today

In `CheckoutScreen`, the user types a code and taps the send icon. When the user places the order, the app calls the existing orders API with:

`POST {API_BASE_URL}/api/orders`

The request JSON is built from `PlaceOrderPayload` in `src/api/orders.ts`.

### Place order payload includes (existing fields)

| Field | Type | Notes |
|------|------|------|
| `customer` | string | Customer display name/email |
| `items` | string | Comma-separated line summary, including quantities/add-ons |
| `type` | `Delivery` \| `Pickup` \| `Dine In` | Matches backend expectations |
| `amount` | string | Subtotal sent from cart (ex: `$14.50`) |
| `address` | string | `Delivery` requires an address payload |
| `phone` | string | optional but usually present |
| `notes` | string | optional |
| `paymentMethod` | string | `Stripe` or `COD` |
| `paymentStatus` | string | `Paid` or `Pending` |
| `paymentId` | string | Stripe payment intent id (if Stripe) |

### New: discount code fields

| Field | Type | Notes |
|------|------|------|
| `discountCode` | string | optional |
| `discount_code` | string | same value (sent for stacks that only bind snake_case) |

If the code is empty/whitespace, the app does **not** send it.

---

## 2) Required backend behavior

When `discountCode` / `discount_code` is provided:

1. Validate the code (existence, active, not expired, not disabled)
2. Validate eligibility (optional rules)
   - minimum order amount (compare against numeric subtotal)
   - max usage counts (global and/or per-customer)
   - applicable to delivery/pickup/dining, if your business rules require it
3. Compute discount according to the discount definition
   - fixed amount (currency-aware)
   - percentage (cap optional)
4. Apply the discount to the order
   - calculate `discountAmount`
   - compute `finalAmount = amount - discountAmount` (never below 0)
5. Persist discount information on the order record.

> Important: The mobile UI does not update the “total” number it displays, and Stripe payment intent amount is created from the current `amount` subtotal in the app. The backend must coordinate discount calculation with payment charging (see §5).

---

## 3) Recommended discount definition model

You can implement this with a `discount_codes` (or similar) table. Suggested fields:

| Field | Type | Notes |
|------|------|------|
| `code` | string (unique) | e.g. `SAVE10` |
| `discountType` | `fixed` \| `percent` | How to calculate |
| `value` | number | fixed currency amount or percent 0-100 |
| `currency` | string | e.g. `gbp` |
| `minSubtotal` | number | optional |
| `startAt` / `endAt` | datetime | optional |
| `maxGlobalUses` | int | optional |
| `maxUsesPerUser` | int | optional |
| `active` | boolean | enabled/disabled |

---

## 4) API endpoints to implement

### 4.1 Validate/apply discount (preview)

Even though the current app does not call this endpoint yet, implementing it makes it possible to correctly update UI and Stripe amount.

**`POST /api/discounts/apply`**

Auth: optional for preview, but recommended if you enforce per-user limits.

Headers:
- `Content-Type: application/json`
- `Authorization: Bearer <token>` (if used)

Body:

```json
{
  "code": "SAVE10",
  "subtotal": "14.50",
  "currency": "gbp",
  "customerId": "user_uuid"
}
```

Response:

```json
{
  "valid": true,
  "discountType": "percent",
  "value": 10,
  "discountAmount": "1.45",
  "finalAmount": "13.05"
}
```

Errors:
- `400` invalid payload / missing code
- `404` code not found
- `409` code invalid/expired/usage exceeded

### 4.2 Place order discount support (required)

Extend the existing endpoint:

**`POST /api/orders`**

The backend should:
- read `discountCode` or `discount_code`
- validate + compute discount
- persist:
  - `discountCode`
  - `discountAmount`
  - `finalAmount`
  - (optional) `discountMeta` like type and raw value

Response should include (recommended for future UI):

```json
{
  "ok": true,
  "orderId": "…",
  "discount": {
    "code": "SAVE10",
    "discountAmount": "1.45",
    "finalAmount": "13.05"
  }
}
```

The current mobile client ignores these fields, but they help Stripe integration and debugging.

---

## 5) Stripe/payment critical note

In `CheckoutScreen`, Stripe payment intent is created using the app's `total` from the cart (before any discount preview is applied).

Because of this:

1. If you reduce `finalAmount` server-side when `paymentMethod = "Stripe"`, the customer may be charged an amount higher than the order final total.
2. To avoid mismatch, recommended integration is:
   - mobile calls `POST /api/discounts/apply` before creating the Stripe payment intent
   - mobile uses `finalAmount` returned by backend to create the payment intent

If you cannot change the mobile flow right now, backend should either:
- treat discounts as metadata only for Stripe orders (do not change charge amount), OR
- return a strict error until the frontend is updated (less desirable).

---

## 6) Logging & failure messaging

When discount is invalid, return a meaningful message in JSON so the app can show it (current app does not handle discount errors specially, but future wiring should).

Suggested:
- `{ "message": "Code expired" }`
- `{ "message": "Invalid code" }`
- `{ "message": "Minimum subtotal not met" }`

---

## 7) Frontend to backend mapping summary

`CheckoutScreen.tsx` -> `placeOrder` -> `POST /api/orders`

| UI field | API field(s) |
|----------|----------------|
| Discount code | `discountCode` and `discount_code` |

Backend must compute and persist:
- `discountAmount`
- `finalAmount`

