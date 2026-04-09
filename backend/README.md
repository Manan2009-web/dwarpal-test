# DwarPal Backend

Production-style Node.js + Express + MongoDB backend for the DwarPal digital college gatepass system.

## Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication
- bcryptjs password hashing
- express-validator
- multer for profile uploads
- cors
- cookie-parser

## Folder Structure

```text
backend/
  docs/
  uploads/
    profiles/
  src/
    config/
    constants/
    controllers/
    middleware/
    models/
    routes/
    seed/
    services/
    utils/
    validators/
    app.js
    server.js
  .env.example
  package.json
  README.md
```

## Main Features

- Public registration for `student` and `faculty` only
- JWT login using email, enrollment number, or employee ID
- Fast auth verification endpoint for app bootstrap and refresh restore
- Role-based protection for `student`, `faculty`, `principal`, `hod`, `cao`, and `security`
- No-store API headers for auth and protected responses
- Student workflow: `pending_principal -> forwarded_to_hod -> approved_by_hod / rejected_by_hod`
- Optional direct Principal approval for student requests using `approved_final`
- Faculty workflow: `pending_cao -> approved_by_cao / rejected_by_cao`
- Security verification, checkout, and check-in completion
- Notifications for submission, forward, approval, rejection, HOD action, and security verification
- Audit logs for important auth, profile, gatepass, and admin actions
- Dashboard summaries for every role
- Polling-ready queue endpoints with pagination, sorting, status filters, and `since` support
- Profile update and profile image upload
- Admin seeding and analytics endpoints

## Roles and Department Rules

Allowed public registration roles:

- `student`
- `faculty`

Admin accounts are seeded, not public:

- `principal`
- `hod`
- `cao`
- `security`

Allowed departments:

- `Computer Engineering`
- `Nursing`
- `Physiotherapy`
- `Electrical Engineering`

## Gatepass Statuses

Student flow:

- `pending_principal`
- `forwarded_to_hod`
- `approved_by_hod`
- `rejected_by_principal`
- `rejected_by_hod`
- `approved_final`
- `checked_out_by_security`
- `completed`
- `cancelled`

Faculty flow:

- `pending_cao`
- `approved_by_cao`
- `rejected_by_cao`
- `checked_out_by_security`
- `completed`
- `cancelled`

## Setup

1. Open the backend folder:

```bash
cd backend
```

2. Install packages:

```bash
npm install
```

3. Create your environment file:

```bash
copy .env.example .env
```

4. Update `.env` with your MongoDB connection and JWT secret.

5. Start the backend:

```bash
npm run dev
```

6. Health-check the server:

```bash
GET http://localhost:5000/api/health
```

## MongoDB Connection

Use either local MongoDB or MongoDB Atlas.

Example local URI:

```env
MONGO_URI=mongodb://127.0.0.1:27017/dwarpal
```

Example Atlas URI:

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dwarpal?retryWrites=true&w=majority
```

## Seed Default Admin Accounts

Option 1: CLI seed

```bash
npm run seed:admins
```

Option 2: API seed with secret header

```http
POST /api/admin/seed-default-admins
x-seed-key: <SEED_ADMIN_KEY>
```

Seeded admin accounts:

- Principal: `principal@dwarpal.local` / `PRI001`
- HOD: `hod@dwarpal.local` / `HOD001`
- CAO: `cao@dwarpal.local` / `CAO001`
- Security: `security@dwarpal.local` / `SEC001`

Password for all seeded admins comes from `DEFAULT_ADMIN_PASSWORD`.

## Core API Routes

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/verify`
- `PATCH /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Users:

- `GET /api/users/profile`
- `PATCH /api/users/profile`
- `POST /api/users/profile/photo`

Dashboard:

- `GET /api/dashboard/summary`

Gatepasses:

- `POST /api/gatepasses`
- `GET /api/gatepasses/my`
- `GET /api/gatepasses/history`
- `GET /api/gatepasses/:id`
- `PATCH /api/gatepasses/:id/edit`
- `PATCH /api/gatepasses/:id`
- `PATCH /api/gatepasses/:id/cancel`
- `GET /api/gatepasses/pending/principal`
- `GET /api/gatepasses/pending/hod`
- `GET /api/gatepasses/pending/cao`
- `GET /api/gatepasses/pending/security`
- `PATCH /api/gatepasses/:id/forward`
- `PATCH /api/gatepasses/:id/approve`
- `PATCH /api/gatepasses/:id/reject`
- `POST /api/gatepasses/:id/forward`
- `POST /api/gatepasses/:id/approve`
- `POST /api/gatepasses/:id/reject`
- `GET /api/gatepasses/security/ready`
- `GET /api/gatepasses/security/verify/:token`
- `PATCH /api/gatepasses/security/checkout/:id`
- `PATCH /api/gatepasses/security/checkin/:id`
- `POST /api/gatepasses/:id/check-out`
- `POST /api/gatepasses/:id/check-in`

Notifications:

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/read-all`
- `PATCH /api/notifications/:id/read`

Admin:

- `POST /api/admin/seed-default-admins`
- `GET /api/admin/analytics`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/status`

## Response Format

Success:

```json
{
  "success": true,
  "message": "Gatepass created successfully",
  "data": {},
  "timestamp": "2026-03-21T08:30:00.000Z"
}
```

Validation or error:

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [],
  "timestamp": "2026-03-21T08:30:00.000Z"
}
```

Paginated endpoints also return:

```json
{
  "meta": {
    "total": 20,
    "page": 1,
    "limit": 10,
    "totalPages": 2,
    "lastUpdated": "2026-03-21T08:30:00.000Z"
  }
}
```

## Auth And Route Protection

- Use `GET /api/auth/verify` or `GET /api/auth/me` on app load to restore auth state.
- Protected APIs return `401` for invalid or expired tokens.
- Role mismatches return `403`.
- API responses are marked `Cache-Control: no-store` to reduce accidental caching of protected data.
- `POST /api/auth/logout` clears the backend cookie. Your frontend should also clear local token state and redirect with `replace: true`.
- Browser back navigation cannot be disabled securely. Use route guards plus history replacement so it stays safe.

## Polling And Live Updates

Recommended polling interval:

- every `10 seconds` for dashboard summary
- every `10 seconds` for queue endpoints
- every `10 seconds` for notifications or unread count

Polling-ready queue endpoints:

- `GET /api/dashboard/summary`
- `GET /api/gatepasses/my?status=&page=&limit=&sortBy=updatedAt&order=desc`
- `GET /api/gatepasses/pending/principal?page=&limit=&sortBy=updatedAt&order=desc`
- `GET /api/gatepasses/pending/hod?page=&limit=&sortBy=updatedAt&order=desc`
- `GET /api/gatepasses/pending/cao?page=&limit=&sortBy=updatedAt&order=desc`
- `GET /api/gatepasses/pending/security?page=&limit=&sortBy=updatedAt&order=desc`
- `GET /api/notifications?page=&limit=&sortBy=updatedAt&order=desc`
- `GET /api/notifications/unread-count`

Optional incremental refresh:

- add `since=<ISO_TIMESTAMP>` to gatepass list and notification list endpoints

## Frontend Auth And Polling Guide

Detailed React examples are available in [docs/ReactAuthPollingGuide.md](/c:/Users/ABC/DwarPal%20Project/backend/docs/ReactAuthPollingGuide.md).

That guide includes:

- protected route logic
- public-only route logic
- role-based route guards
- `navigate(..., { replace: true })` usage after login, register, and logout
- auth restoration with `/api/auth/verify`
- axios interceptor examples
- 10-second polling with cleanup on unmount
- latest-response-only strategy to prevent stale UI overwrite
- security notes for logout and back-button behavior

## Workflow Summary

Student:

1. Student creates gatepass.
2. Principal reviews it.
3. Principal can approve directly, reject, or forward to HOD.
4. HOD can approve or reject forwarded student requests.
5. Principal receives HOD action notification.
6. Security verifies approved passes and marks check-out/check-in.

Faculty:

1. Faculty creates gatepass.
2. CAO approves or rejects.
3. Security verifies approved passes and marks check-out/check-in.

## Postman Testing Flow

1. Call `POST /api/admin/seed-default-admins` with `x-seed-key`.
2. Register a student or faculty account.
3. Login and store the JWT from the response.
4. Use `Authorization: Bearer <token>` for protected APIs.
5. Create a gatepass.
6. Login as Principal, HOD, or CAO and perform approval actions.
7. Login as Security and call verify, check-out, and check-in endpoints.

The Postman collection is available at [docs/DwarPal.postman_collection.json](/c:/Users/ABC/DwarPal%20Project/backend/docs/DwarPal.postman_collection.json).

## Frontend Integration

Use either `fetch` or `axios`. Send the JWT in the `Authorization` header.

Example with `fetch`:

```js
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    identifier: '2021001',
    password: 'Password@123'
  })
});

const result = await response.json();
localStorage.setItem('token', result.data.token);
```

Example protected request:

```js
const token = localStorage.getItem('token');

const response = await fetch('http://localhost:5000/api/dashboard/summary', {
  headers: {
    Authorization: `Bearer ${token}`
  },
  credentials: 'include'
});
```

## Which Frontend Screens Should Call Which APIs

Login screen:

- `POST /api/auth/login`

Register screen:

- `POST /api/auth/register`

Profile screen:

- `GET /api/users/profile`
- `PATCH /api/users/profile`
- `POST /api/users/profile/photo`

App bootstrap:

- `GET /api/auth/verify`

Student and faculty dashboard:

- `GET /api/dashboard/summary`
- `GET /api/gatepasses/my?sortBy=updatedAt&order=desc&page=1&limit=10`
- `GET /api/notifications/unread-count`

Create gatepass screen:

- `POST /api/gatepasses`

My gatepass/history screen:

- `GET /api/gatepasses/my`
- `GET /api/gatepasses/history`
- `GET /api/gatepasses/:id`
- `PATCH /api/gatepasses/:id`
- `PATCH /api/gatepasses/:id/edit`
- `PATCH /api/gatepasses/:id/cancel`

Principal dashboard:

- `GET /api/gatepasses/pending/principal?sortBy=updatedAt&order=desc&page=1&limit=10`
- `PATCH /api/gatepasses/:id/approve`
- `PATCH /api/gatepasses/:id/reject`
- `PATCH /api/gatepasses/:id/forward`
- `GET /api/dashboard/summary`

HOD dashboard:

- `GET /api/gatepasses/pending/hod?sortBy=updatedAt&order=desc&page=1&limit=10`
- `PATCH /api/gatepasses/:id/approve`
- `PATCH /api/gatepasses/:id/reject`
- `GET /api/dashboard/summary`

CAO dashboard:

- `GET /api/gatepasses/pending/cao?sortBy=updatedAt&order=desc&page=1&limit=10`
- `PATCH /api/gatepasses/:id/approve`
- `PATCH /api/gatepasses/:id/reject`
- `GET /api/dashboard/summary`

Security dashboard:

- `GET /api/gatepasses/pending/security?sortBy=updatedAt&order=desc&page=1&limit=10`
- `GET /api/gatepasses/security/verify/:token`
- `PATCH /api/gatepasses/security/checkout/:id`
- `PATCH /api/gatepasses/security/checkin/:id`
- `GET /api/dashboard/summary`

Notification panel:

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`
- `GET /api/notifications/unread-count`

## Notes

- The backend accepts cookies and Bearer tokens. For frontend apps, Bearer tokens are usually the easiest option.
- Profile uploads are served from `/uploads/profiles/...`.
- Approved gatepasses include a `verificationToken` that your frontend or mobile app can convert into a QR code later.
- If you want to proxy API calls from Vite, point your frontend base URL to `http://localhost:5000/api`.
