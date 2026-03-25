# MEXICANO — Push notifications (backend integration guide)

This document describes how the **MEXICANO** mobile app (Expo / React Native) handles push notifications and what the **backend and admin flows** must implement so users receive alerts when an **order status changes** (or for other events you add later).

---

## 1. Architecture (high level)

```
┌─────────────┐     updates status      ┌──────────────────┐
│ Admin portal│ ───────────────────────► │ Your backend API │
└─────────────┘                          │  (PHP / etc.)    │
                                         └────────┬─────────┘
                                                  │
                    stores Expo push token        │  on status change:
                    per user (from mobile)        │  POST Expo Push API
                                                  ▼
                                         ┌──────────────────┐
                                         │ Expo Push        │
                                         │ (relays to FCM / │
                                         │  APNs)           │
                                         └────────┬─────────┘
                                                  │
                                                  ▼
                                         ┌──────────────────┐
                                         │ User’s phone     │
                                         │ (MEXICANO app)   │
                                         └──────────────────┘
```

**Important:** The server **does not** call the mobile app over HTTP. Phones are not reachable that way. After the user registers a push **token** with your API, the **only** way to reach the device is **push** (Expo → FCM on Android / APNs on iOS).

---

## 2. What the mobile app already does

| Item | Detail |
|------|--------|
| SDK | `expo-notifications` (Expo managed workflow). |
| EAS Project ID | `f2eabc34-f5c5-4951-b986-f073deb5d948` (in app config; required on the client to obtain Expo push tokens). |
| When tokens are registered | After the user grants notification permission: on app load (`App.tsx`) and after login (`LoginRegisterScreen`). |
| Physical device | Push **only works on real devices**, not simulators/emulators without Google Play (Android). |
| Logout | App sends **unregister** so you can remove the token from the user’s account. |

The app’s **production API base URL** defaults to:

`https://phpstack-1046663-6238875.cloudwaysapps.com`

(Overridable via `EXPO_PUBLIC_API_BASE_URL` at build time.)

---

## 3. Endpoints the mobile app calls today

These paths are **relative to the API base URL** above.

### 3.1 Register device (store Expo push token)

**`POST /api/push/register`**

**Headers**

- `Content-Type: application/json`
- **Recommendation:** Require the same **auth** you use for logged-in APIs (e.g. `Authorization: Bearer <access_token>`), and associate the token with the **authenticated user**.  
  *The current mobile client may not send auth yet—confirm with the app team and align.*

**Body (JSON)**

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios"
}
```

`platform` is one of: `"ios"`, `"android"`, `"expo"` (app sends `ios` or `android` when applicable).

**Expected behaviour**

- Upsert: store **one or more tokens per user** (user can reinstall app or use multiple devices).
- Invalidate old tokens when Expo returns `DeviceNotRegistered` (see section 6).

**Success**

- Respond with `2xx` (e.g. `200` or `204`).

**Errors**

- Return a clear `4xx/5xx` with body the client can log.

---

### 3.2 Unregister device (logout)

**`DELETE /api/push/register`**

**Headers**

- `Content-Type: application/json`
- Auth as above (recommended).

**Body (JSON)**

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Expected behaviour**

- Remove this token from the user (or mark inactive) so you **stop sending** pushes to it after logout.

### 3.3 How the token is used (important)

The Expo push token is **only a destination address**. The app does not “use” it to show notifications by itself.

What happens after you store it:

1. When admin changes an order status, your **backend** looks up the customer for that order.
2. Your backend loads all **active tokens** for that customer.
3. Your backend sends a push to Expo using that token (`to` field).
4. Expo delivers the notification to the user’s phone.

So the token log on the device (example: `[Push] Registered: ExponentPushToken[...]`) only confirms **registration** with your API; it does not confirm that a notification will be delivered until the backend sends a push.

---

## 4. What you must implement for “order status changed”

When an **admin changes an order’s status** in the admin portal:

1. **Persist** the new status as you already do.
2. **Resolve the customer** tied to that order (user id / account).
3. **Load** all active **Expo push tokens** for that user.
4. For each token, **send a push** using the **Expo Push API** (section 5).
5. Optionally include a **data** payload (JSON) so the app can open the right order screen when the user taps the notification (deep linking can be added on the app side later).

There is **no separate “call the mobile API”** step for delivery—the push is the delivery mechanism.

---

## 5. Sending pushes — Expo Push API

**Official docs:** [Send notifications with Expo](https://docs.expo.dev/push-notifications/sending-notifications/)

### 5.1 Endpoint

```http
POST https://exp.host/--/api/v2/push/send
Content-Type: application/json
```

(Optional: Expo access token in headers for advanced usage; see Expo docs if you need higher quotas or unified receipts.)

### 5.2 Request body

An array of **message objects**. Minimal example:

```json
[
  {
    "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "title": "Order update",
    "body": "Order #1234 is now: Shipped",
    "sound": "default",
    "priority": "high",
    "data": {
      "type": "order_status",
      "orderId": "1234",
      "status": "shipped"
    }
  }
]
```

Notes:

- **`to`**: must be the exact string saved from the mobile app (`ExponentPushToken[...]`).
- **`data`**: custom JSON; keep it small. Useful for in-app navigation after tap.
- **`priority`**: `"high"` helps timely delivery on Android.
- You can send **up to 100 messages per request** (batch array).

### 5.3 Example (cURL)

```bash
curl -H "Content-Type: application/json" \
  -X POST "https://exp.host/--/api/v2/push/send" \
  -d '[{"to":"ExponentPushToken[xxxx]","title":"Order update","body":"Your order status changed","data":{"orderId":"1234"}}]'
```

### 5.4 Response and errors

- Expo returns a JSON object with per-ticket status.
- Handle **transient failures**: network errors, `5xx`, rate limits — use **retries with backoff**.
- If a token is invalid or the app was uninstalled, Expo may report errors such as **`DeviceNotRegistered`**. **Delete that token** from your DB so you don’t keep sending to dead endpoints.

---

## 6. Token lifecycle checklist

| Event | Backend action |
|--------|----------------|
| `POST /api/push/register` | Store token ↔ user (and optionally `platform`, `updated_at`). |
| User logs in on a new phone | New token registered; store alongside or replace policy per product decision. |
| `DELETE /api/push/register` | Remove or deactivate token. |
| Expo push result `DeviceNotRegistered` / invalid token | Remove token. |
| Order status changes | Send push to all valid tokens for that order’s customer. |

---

## 7. Security and privacy

- **Authenticate** register/unregister endpoints so tokens cannot be bound to arbitrary users.
- **Do not** log full tokens in production logs if not necessary (treat as device identifiers).
- **Admin actions** should be authorized; only send pushes for legitimate status updates.

---

## 8. Testing

1. Install a **release/preview build** or dev build on a **physical device**; complete login and accept notifications.
2. Confirm a row appears in your DB from `POST /api/push/register`.
3. Trigger a status change from admin; confirm Expo Push API returns success and the device shows the notification.
4. Use [Expo’s push notification tool](https://expo.dev/notifications) for quick manual tests if needed.

---

## 9. Summary for implementation tickets

| Task | Owner |
|------|--------|
| `POST /api/push/register` — persist token for authenticated user | Backend |
| `DELETE /api/push/register` — remove token on logout | Backend |
| On **order status update** (admin API): load user tokens → call Expo Push API | Backend |
| Retry / prune dead tokens (`DeviceNotRegistered`) | Backend |
| (Optional) Auth headers on register if not already | App + Backend |

---

## 10. Reference — Expo project (client)

| Field | Value |
|--------|--------|
| App name | MEXICANO |
| Slug | MexicanoApp |
| Android package | `com.mexicanoapp` |
| EAS Project ID | `f2eabc34-f5c5-4951-b986-f073deb5d948` |

---

*Document generated for backend handoff — MEXICANO mobile app (Expo push). For API URL changes, sync with the app repository `app.config.js` and `EXPO_PUBLIC_API_BASE_URL`.*
