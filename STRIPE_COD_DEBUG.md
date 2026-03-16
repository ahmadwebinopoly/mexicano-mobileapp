# Why Admin Still Shows COD Instead of Stripe

## Summary
The mobile app already sends `paymentMethod: "Stripe"` and `paymentStatus: "Paid"` when placing an order after successful Stripe payment (Option A). The backend accepts and stores these fields. If the admin still shows COD, the most likely cause is **different backends / databases**.

---

## Check #1: Same API URL?

| App | Config | Current Value |
|-----|--------|---------------|
| **Mobile** | `EXPO_PUBLIC_API_BASE_URL` (in .env) | `https://phpstack-1046663-6238875.cloudwaysapps.com` |
| **Admin** | `VITE_API_URL` (in mexicano-admin/.env) | Usually `http://localhost:3001` (dev) or your production URL |

**The mobile and admin must hit the SAME API server.**

- If mobile uses `https://phpstack-xxx.cloudwaysapps.com` and admin uses `http://localhost:3001` or another domain, they are talking to **different backends** → different databases → admin never sees Stripe/Paid.
- **Fix:** Set `VITE_API_URL` in the admin’s production build to the same URL as `EXPO_PUBLIC_API_BASE_URL` (e.g. `https://phpstack-1046663-6238875.cloudwaysapps.com`).

---

## Check #2: Backend Logs

When placing an order with Stripe on the mobile, the backend logs:

```
[Orders] Creating order with Stripe/Paid – paymentMethod: Stripe paymentStatus: Paid
```

- If you see this log → the server receives Stripe/Paid and should store it.
- If you never see it → the request is not reaching this backend (e.g. different API or different deployment).

---

## Check #3: Database

Query the `Order` table:

```sql
SELECT id, orderId, customer, paymentMethod, paymentStatus, createdAt 
FROM `Order` 
ORDER BY createdAt DESC 
LIMIT 10;
```

- If `paymentMethod` is `"Stripe"` and `paymentStatus` is `"Paid"` → data is correct; the admin might be reading from another DB or cache.
- If they are still `"COD"` / `"Pending"` → the request is not reaching the Node API that stores them, or that API is not the one the mobile calls.

---

## What the mobile app sends

`placeOrder()` payload when Stripe is used:

```json
{
  "customer": "...",
  "items": "...",
  "type": "Delivery",
  "amount": "$25.00",
  "address": "...",
  "phone": "...",
  "paymentMethod": "Stripe",
  "paymentStatus": "Paid",
  "paymentId": "pi_xxx"
}
```

The backend (Node/Express) reads `paymentMethod` and `paymentStatus` (plus `payment_method` / `payment_status` for compatibility).

---

## Quick verification

1. Ensure mobile and admin use the same API base URL in production.
2. Place a Stripe order from the mobile app.
3. Check backend logs for `[Orders] Creating order with Stripe/Paid`.
4. In the admin, refresh the Orders page and confirm the order shows Stripe (Card) and Paid.
5. If still COD, run the SQL above and confirm whether Stripe/Paid is in the database.

---

## If using a different backend (e.g. PHP on Cloudways)

If the mobile calls a **PHP backend** (or any other stack) instead of the Node mexicano-admin API:

- That backend must accept `paymentMethod` and `paymentStatus` and store them in its orders table.
- The admin (if it uses the Node API) would only see orders from the Node backend. In that case you either:
  - Point the mobile to the Node API, or
  - Point the admin to the same backend the mobile uses (and ensure that backend persists payment fields).
