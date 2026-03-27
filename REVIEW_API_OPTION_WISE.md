# Review API Contract (Option Wise)

This document defines the review payload based on order type:

- `Delivery`
- `Pickup` (a.k.a. `Take away`)
- `Dine In`

The mobile app will send different experience fields depending on order type.

---

## Endpoint

- **Method:** `POST`
- **Path:** `/api/reviews`
- **Auth:** Bearer token required
- **Content-Type:** `application/json`

---

## Common Payload Fields

These fields are sent for all order types:

```json
{
  "orderId": "12345",
  "orderType": "Delivery",
  "dishRating": 4,
  "dishTag": "Perfect Spice"
}
```

### Field definitions

- `orderId` (string, required): unique order id
- `orderType` (string, required): one of `Delivery`, `Pickup`, `Dine In`
- `dishRating` (number, required): `1..5`
- `dishTag` (string, optional): selected dish quick tag

---

## Experience Fields by Order Type

The app sends an `experience` object with **3 ratings** (all required, range `1..5`).

### 1) Delivery

```json
{
  "orderId": "12345",
  "orderType": "Delivery",
  "dishRating": 4,
  "dishTag": "Perfect Spice",
  "experience": {
    "foodQuality": 5,
    "deliverySpeed": 4,
    "packaging": 4
  }
}
```

### 2) Pickup (Take away)

```json
{
  "orderId": "12345",
  "orderType": "Pickup",
  "dishRating": 4,
  "dishTag": "Ready on Time",
  "experience": {
    "foodQuality": 5,
    "pickupSpeed": 4,
    "packaging": 4
  }
}
```

### 3) Dine In

```json
{
  "orderId": "12345",
  "orderType": "Dine In",
  "dishRating": 4,
  "dishTag": "Great Service",
  "experience": {
    "foodQuality": 5,
    "staffService": 4,
    "ambience": 4
  }
}
```

---

## Validation Rules (Backend)

- Reject if `orderId` is missing/invalid.
- Reject if `orderType` is not one of: `Delivery`, `Pickup`, `Dine In`.
- Reject if any required rating is outside `1..5`.
- Reject duplicate review for the same `orderId` by same user (if one-review-per-order policy).

---

## Success Response (Suggested)

```json
{
  "success": true,
  "message": "Review submitted successfully",
  "reviewId": "rev_98765"
}
```

## Error Response (Suggested)

```json
{
  "success": false,
  "message": "Invalid review payload",
  "errors": [
    "experience.deliverySpeed is required for Delivery"
  ]
}
```

---

## Notes

- Mobile currently switches experience labels by order type and supports interactive star ratings.
- If backend prefers a flat schema instead of nested `experience`, share final format and mobile can map accordingly.
