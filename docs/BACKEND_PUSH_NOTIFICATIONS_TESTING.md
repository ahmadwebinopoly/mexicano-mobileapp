# MEXICANO — Push Notifications (Backend Testing Checklist)

This document is for the backend team to verify push notifications are working end-to-end for **order status changes**.

## 0. What “working” means

Push is considered working when:

- Your backend successfully **stores** the customer’s Expo push token (`POST /api/push/register`)
- When an admin changes an order status, your backend successfully **sends** a push via Expo
- The customer’s phone receives the notification (system banner / lock screen)

This doc helps you isolate failures between these steps.

## 1. Prerequisites

- A physical phone (Expo Go / dev build installed)
- The phone has notification permission enabled for the app
- Your backend has a way to read:
  - the saved token in DB (for a specific user/customer)
  - logs around the admin order-status update + push sending

## 2. Verify token registration (server side)

### 2.1 Confirm the request hits your backend

When the mobile app registers, verify backend logs show:

- `POST /api/push/register`
- request body contains `{ token, platform }`
- response is `2xx`

### 2.2 Confirm the token is saved for the correct user

In DB, confirm you have a row like:

- `user_id` (or customer id)
- `expo_push_token` (the `ExponentPushToken[...]` string)
- `platform` (ios/android/expo)
- `active = true` (or equivalent)

If tokens are stored “globally” without linking to a user, then order-status pushes may go to the wrong user.

## 3. Manual test push (isolate Expo delivery)

This step proves: **backend -> Expo -> phone**.

### 3.1 Use Expo Push API directly

Copy the token saved in your DB:

`ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`

Send a test message:

```bash
curl -H "Content-Type: application/json" \
  -X POST "https://exp.host/--/api/v2/push/send" \
  -d '[
    {
      "to": "ExponentPushToken[PUT_TOKEN_HERE]",
      "title": "MEXICANO test",
      "body": "If you see this, push delivery works.",
      "sound": "default",
      "priority": "high",
      "data": { "type": "test" }
    }
  ]'
```

### 3.2 Interpret Expo response

Expo returns JSON with per-message “tickets”.

If you see errors such as:

- `DeviceNotRegistered`
- invalid token format
- other 4xx/5xx

Then your backend should **remove/deactivate** that token and not retry endlessly.

## 4. Test the real admin flow (order status changed)

After manual test push works, validate the integration that matters:

### 4.1 Setup

- Pick a user who is logged into the phone you tested
- Pick an order belonging to that user

### 4.2 Trigger

In the admin portal:

- change the order status (example: `Processing -> Shipped`)

### 4.3 Backend expectations

When the admin status update request completes, your backend should do:

1. Save the new order status
2. Resolve the **customer/user** for that order
3. Load all **active Expo tokens** for that user
4. Send pushes to Expo for each token
5. Handle per-token failures (prune invalid tokens)

### 4.4 Verify on the device

The customer phone should receive:

- a notification banner/sound (based on your app’s `expo-notifications` handler)

Optional:
- If they tap the notification, the app may open an order screen.
  - In the current app code, tap handling is registered but deep-link navigation logic must be implemented/confirmed in the app team.

## 5. Logging requirements (for debugging)

Add/confirm logs around these points:

- After `POST /api/push/register`: log `user_id` and token row id (do not log full token in production if you can avoid it)
- On admin order-status update:
  - `order_id`
  - resolved `user_id/customer_id`
  - number of active tokens found
  - Expo send request id / batch id
  - Expo response status and errors per ticket

## 6. Common failure modes and what to check

### 6.1 Token saved, but no push on admin update

Most common causes:

- Backend sends to wrong user (token stored without correct user association)
- Backend never triggers “send push” in the order-status code path
- Backend sends wrong token field (not the `ExponentPushToken[...]` string)
- Backend filters tokens as inactive/unverified

### 6.2 Expo returns `DeviceNotRegistered`

- Token is dead (app uninstalled / token rotated)
- Delete/deactivate the token and re-test

### 6.3 Expo returns transient errors (503 / network issues)

- Implement retries with exponential backoff
- Do not mark token dead for transient failures

## 7. Acceptance criteria

For at least one user + one order:

- Token saved successfully
- Manual test push shows on device
- Admin order-status change shows notification on device
- Invalid token cleanup works (or is at least handled safely)

## 8. If you need a quick coordination point

When you test, send back to mobile team:

- example token row id (or user id)
- admin status change log lines around push sending
- Expo response (success tickets vs errors)

Then we can confirm whether the issue is: **token linking**, **backend send logic**, or **device permission/UI handling**.

