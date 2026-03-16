# Delivery Location – API Specification (Backend)

This document describes the **delivery location** data collected in the Mexicano app during onboarding when the user selects **Delivery**. Use this payload shape for any API that accepts or returns a delivery address (e.g. save address, set delivery address, get delivery address).

---

## 1. When is this data created?

- **Flow:** User selects **Delivery** on onboarding → app shows the **Delivery location** step.
- **Step actions:**
  1. User taps **Use my location** → app gets GPS coordinates (lat/lng) and reverse-geocodes to pre-fill **City**, **State**, **Zip code** only.
  2. User **manually enters** **Full address** (street, building, area). This is never taken from GPS.
  3. User may optionally enter: **Label** (e.g. Home, Office), **Floor**, **Home / Flat no.**
  4. User taps **Save & Continue** → app builds the payload below and stores it (e.g. locally; later it can be sent to your API).

---

## 2. Payload shape (Delivery Address)

The app sends a **JSON object** with the following fields.

| Field               | Type    | Required | Description |
|---------------------|---------|----------|-------------|
| `latitude`          | number  | **Yes**  | Latitude from GPS (user must have used “Use my location”). |
| `longitude`         | number  | **Yes**  | Longitude from GPS. |
| `address`           | string  | **Yes**  | Full delivery address. Manually entered by user. If user filled Floor and/or Home no., the app appends them, e.g. `"<full address>, Floor X, <home no.>"`. |
| `customerLocation`  | string  | No       | Label for the place (e.g. `"Home"`, `"Office"`). Defaults to `"Home"` if empty. |
| `city`              | string  | No       | City (can be pre-filled from reverse geocode; user can edit). |
| `state`             | string  | No       | State / region (can be pre-filled from reverse geocode; user can edit). |
| `zipCode`           | string  | No       | Zip / postal code (can be pre-filled from reverse geocode; user can edit). |
| `floor`             | string  | No       | Floor (optional). Omitted if empty. |
| `homeNo`            | string  | No       | Flat / apartment / unit number (optional). Omitted if empty. |

---

## 3. Example payload (JSON)

```json
{
  "latitude": 25.123456,
  "longitude": 55.234567,
  "address": "123 Main Street, Building A, Floor 2, Apt 5",
  "customerLocation": "Home",
  "city": "Dubai",
  "state": "Dubai",
  "zipCode": "12345",
  "floor": "2",
  "homeNo": "5"
}
```

Minimal example (only required fields):

```json
{
  "latitude": 25.123456,
  "longitude": 55.234567,
  "address": "123 Main Street, Building A"
}
```

---

## 4. Validation rules (app-side)

- **Required:** `latitude`, `longitude`, `address` (non-empty after trim).
- **Optional:** `customerLocation`, `city`, `state`, `zipCode`, `floor`, `homeNo`.
- The backend may enforce additional rules (e.g. valid lat/lng range, non-empty `city` for delivery zones).

---

## 5. Suggested backend usage

- **Save delivery address:** Accept `POST` (or `PUT`) with the body as the object above; associate with the current user/session.
- **Get delivery address:** Return the same shape (or a list of addresses in this shape).
- **Order / checkout:** Use the same structure for “delivery address” when creating an order (e.g. `deliveryAddress` object or flattened fields).

---

## 6. Alignment with existing app types

The app’s existing **Save Address** payload (`SaveAddressPayload`) already uses: `latitude`, `longitude`, `address`, `customerLocation`, `city`, `state`, `zipCode`. The onboarding delivery payload extends this with optional `floor` and `homeNo`; the backend can accept these and store them if needed for delivery instructions.
