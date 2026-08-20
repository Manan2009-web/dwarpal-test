# DwarPal — Notification Layer Status

> **Purpose of this document:** Record exactly which notification layers are real,
> which are mocked, and what configuration is needed for each. Update this doc
> whenever a layer's wiring status changes.
>
> This prevents the AharSetu situation where a health-check endpoint reported
> "VAPID Web Push Service: active" when Web Push had never been actually wired up.

---

## Layer 1 — WebSocket (Socket.io) — REAL & WIRED

| Item | Status |
|---|---|
| Transport | socket.io v4 over ws:// / wss:// |
| Auth mechanism | JWT passed via socket.handshake.auth.token (never in URL query string) |
| Room isolation | Per-user rooms keyed as user:<userId> |
| Events emitted by server | notification:created, notification:read, notification:read-all, pong |
| Events emitted by client | ping (keepalive every 10 s) |
| Reconnection | socket.io built-in exponential backoff + app-level socketStatus tracking |
| UI indicator | socketStatus enum (connecting/connected/reconnecting/disconnected) exposed in useNotifications() context |
| Polling fallback | ACTIVE — GET /api/v1/notifications polls every 5 s when socketStatus !== connected. Stops immediately on reconnect. |
| Configuration required | None beyond JWT_SESSION_SECRET in backend .env |

---

## Layer 2 — Web Push (VAPID) — REAL & WIRED

| Item | Status |
|---|---|
| Library | web-push v3 (Node.js backend) |
| VAPID keys | Generated and stored in backend/.env (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) |
| Public key delivery | GET /api/v1/public/frontend-config -> vapidPublicKey |
| Subscription model | PushSubscription MongoDB collection (userId, endpoint, keys.p256dh, keys.auth) |
| Subscribe endpoint | POST /api/v1/notifications/subscribe |
| Stale subscription cleanup | 410 / 404 responses auto-delete subscriptions from MongoDB |
| Service worker push handler | public/sw.js push event -> self.registration.showNotification() — fires even with no tab open |
| notificationclick handler | public/sw.js — focuses/opens the app at relatedRoute |
| ENABLE_WEB_PUSH flag | Must be true in backend/.env for push to be active (currently: true) |

### Gatepass events that trigger Web Push

| Event | Recipients |
|---|---|
| Gatepass created | Assigned approver (Principal / HOD / Coordinator) |
| Gatepass approved | Student (requester) |
| Gatepass rejected | Student (requester) |
| Gatepass checked out (security) | All campus_security + admin role users |
| Gatepass checked in / returned | All campus_security + admin role users + student |
| Campus security clearance granted | Student + all admin role users |
| Gatepass overdue return | Student + all campus_security / security / admin role users |

Note: Overdue-return push fires once per gatepass via the escalation sweep scheduler
(flagged with expiryNudgeSentAt on the Gatepass document).

---

## Firebase FCM — PARTIALLY CONFIGURED (gracefully skipped when absent)

| Item | Status |
|---|---|
| Firebase Admin SDK | firebase-admin installed but no service account configured in current env |
| Firebase Web SDK | Installed and wired in src/lib/firebase.js |
| Effect of missing config | getFirebaseMessagingService() returns null; all Firebase push paths silently skipped |
| How to activate | Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in backend/.env |

---

## Layer 3 — HTTP Polling Fallback — REAL & WIRED

| Item | Status |
|---|---|
| Trigger condition | socketStatus !== connected |
| Poll endpoint | GET /api/v1/notifications |
| Interval | 5 000 ms |
| Stop condition | Stops automatically when socketStatus === connected |
| Silent mode | No loading spinner or error toast for individual poll failures |

---

## PushPromptBanner — REAL & WIRED

| Item | Status |
|---|---|
| Component | src/components/PushPromptBanner.jsx |
| Mounting | Inside NotificationProvider in authenticated app shell |
| Trigger condition | Notification.permission === default AND serviceWorker + PushManager available |
| Permission request | Only on explicit "Enable" click — NEVER on mount |
| Dismissal | sessionStorage key dwarpal:push-banner-dismissed — hides for current session only |

---

## What is NOT implemented

| Feature | Status |
|---|---|
| SMS / WhatsApp notifications | Not planned |
| Email for real-time events | Email is sent separately via emailService.js for workflow steps |
| Push subscription management UI | Stale subscriptions cleaned up on 410/404 from push delivery |

---

Last updated: 2026-08-20 by implementation agent.
