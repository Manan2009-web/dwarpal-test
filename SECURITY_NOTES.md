# DwarPal Security Notes

## Public vs Secret Configuration

### Public (safe to reach browser)
- `VITE_API_BASE_URL`
- `VITE_API_REQUEST_TIMEOUT_MS`
- `VITE_AUTH_REQUEST_TIMEOUT_MS`
- `VITE_BACKEND_WARMUP_TIMEOUT_MS`
- Firebase **Web** config returned by backend `/api/public/frontend-config`:
  - `FIREBASE_WEB_API_KEY`
  - `FIREBASE_WEB_AUTH_DOMAIN`
  - `FIREBASE_WEB_PROJECT_ID`
  - `FIREBASE_WEB_STORAGE_BUCKET`
  - `FIREBASE_WEB_MESSAGING_SENDER_ID`
  - `FIREBASE_WEB_APP_ID`
  - `FIREBASE_WEB_MEASUREMENT_ID`
  - `FIREBASE_WEB_VAPID_KEY`

### Secret (backend-only)
- `MONGO_URI`
- `JWT_SECRET`
- `SMTP_PASS`
- Firebase Admin credentials:
  - `FIREBASE_PRIVATE_KEY`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - `FIREBASE_SERVICE_ACCOUNT_BASE64`
- Any future third-party server tokens, private keys, or client secrets

## What Was Changed

- Removed Firebase web config from frontend `VITE_*` usage.
- Added backend public config endpoint: `GET /api/public/frontend-config`.
- Refactored frontend Firebase setup to fetch runtime config from backend instead of embedding values at build time.
- Removed Firebase config from service worker query parameters (`/firebase-messaging-sw.js?...` no longer used).
- Tightened frontend auth/debug logging to avoid leaking request/response details.
- Hardened backend error responses so stack traces are not returned to clients.
- Updated `.env.example` and `backend/.env.example` to separate frontend-safe and backend-only values.

## Why Browser-Side Secrets Cannot Be Hidden

Any value needed by browser JavaScript is ultimately visible to users through source code, network inspection, or runtime instrumentation. Obfuscation/base64 does not make credentials secret. Real secrets must stay server-side and be used only in backend code.

## Provider Restriction Guidance (Required)

- Firebase Web API key should be restricted in Google Cloud Console:
  - Restrict by HTTP referrer (allowed frontend domains only).
  - Restrict API usage to only the Firebase APIs required by this app.
- VAPID key should be used only for web push and rotated if exposed unexpectedly.
- Enforce Firebase Auth/Firestore/Storage security rules; never rely on key secrecy for authorization.

