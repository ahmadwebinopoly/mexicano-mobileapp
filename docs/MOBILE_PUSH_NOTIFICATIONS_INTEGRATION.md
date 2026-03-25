# MEXICANO — Push Notifications (Mobile Integration Guide)

This guide explains how the **MEXICANO** Expo mobile app should integrate with your backend to receive push notifications when an admin updates an order status.

## 1. Prerequisites

- Expo managed workflow
- `expo-notifications` installed
- Working Expo push token flow (requires a physical device; simulators usually won't work)
- App must be configured with an EAS Project ID for obtaining Expo push tokens

## 2. API base URL (mobile app)

All app API calls (including push register/unregister) use the shared API base URL from:

- `EXPO_PUBLIC_API_BASE_URL` (env var)
- fallback: `app.config.js` -> `expo.extra.apiBaseUrl`

Example for env var:

```bash
EXPO_PUBLIC_API_BASE_URL=https://phpstack-1046663-6238875.cloudwaysapps.com
```

## 3. Register the Expo push token

When the user grants notification permission and the app obtains an Expo push token, the app calls your backend to store that token.

### 3.1 Endpoint

`POST /api/push/register`

### 3.2 Request body (JSON)

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios"
}
```

`platform` is the current platform:
- `"ios"` when `Platform.OS === "ios"`
- `"android"` when `Platform.OS === "android"`
- (fallback) `"expo"` for any other platform

### 3.3 Authorization / user mapping (important)

In the current app code, `POST /api/push/register` is sent with **`Content-Type: application/json` only** (no explicit `Authorization: Bearer ...` header).

So, backend must associate the token with the correct user using one of the following approaches:

1. **Cookie/session-based auth**: backend identifies the user via a session cookie.
2. **Anonymous register + later association**: backend maps the token to the logged-in user in a separate step (if you implement that).
3. **Update the app to send Authorization**: if backend requires Bearer auth, the mobile team must update `registerPush()` to include the user token from local storage.

### 3.4 When registration is called (current app behavior)

- `App.tsx`: on app start, if auth token exists in local storage, it calls `registerForPushNotifications()`.
- `LoginRegisterScreen.tsx`: after a successful login, it calls `registerForPushNotifications()`.

## 4. Unregister on logout (optional but recommended)

When a user logs out (or disables notifications), remove the token on the backend to avoid sending pushes to a logged-out device.

### 4.1 Endpoint

`DELETE /api/push/register`

### 4.2 Request body (JSON)

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

### 4.3 Authorization / user mapping

Same note as registration: the current app does not send explicit Bearer auth headers for this endpoint.

## 5. What payload the backend should send

When an admin updates an order status in the admin portal, the backend should send a push notification to the customer's stored Expo tokens.

The mobile app can inspect the notification `data` payload when the user taps the notification (notification-response handler).

### Expected `data` JSON (recommended)

```json
{
  "type": "order_status",
  "orderId": "1234",
  "status": "Shipped"
}
```

## 6. Notification display in the foreground

The app sets an `expo-notifications` handler so that notifications are shown (alerts, banners, sound, etc.) even while the app is in the foreground.

## 7. Token cleanup

If Expo reports that a device token is no longer registered (for example after uninstall), your backend should remove/deactivate that token from the database.

## 8. Testing checklist (mobile side)

1. Install a release/preview build (or dev build) on a physical device.
2. Login and accept notification permission.
3. Verify your backend logs/show that `POST /api/push/register` is received.
4. Change an order status in the admin portal.
5. Confirm the device receives the notification banner/alert.

## 9. Optional: navigate on notification tap

Your app currently registers `addNotificationResponseReceivedListener(...)` but does not include navigation logic inside it.

To deep link when the user taps the notification:
- parse `response.notification.request.content.data` (e.g. `type`, `orderId`)
- navigate to the Order Details screen for that `orderId`

