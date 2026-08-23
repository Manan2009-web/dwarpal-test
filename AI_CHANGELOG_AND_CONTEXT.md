# 📘 DwarPal - Master AI Context, Changelog & Handover Guide

> **IMPORTANT INSTRUCTION FOR ALL AI ASSISTANTS:**
> Whenever the user asks you to make changes or solve an error in this project, you **MUST ALWAYS** update this file (`AI_CHANGELOG_AND_CONTEXT.md`) by appending the user's request, the changes made, the files touched, and the status under the **Changelog & Session History** section. This ensures seamless continuity across AI sessions.

---

## 🏛️ 1. Project Overview & Architecture

**DwarPal** is a full-stack digital college gatepass, faculty leave workflow, security access, and student management platform for higher education institutions.

### Tech Stack
- **Frontend**: React 18, Vite, React Router DOM v6, Framer Motion, Lucide Icons, Tailwind CSS / Custom CSS Tokens, XLSX, PapaParse.
- **Backend**: Node.js, Express, Socket.io (Real-time events), Mongoose, MongoDB / MongoDB Memory Server.
- **Email Layer**: Multi-provider delivery with automatic HTTPS fallback:
  - **Brevo (Sendinblue) REST API** (`BREVO_API_KEY`) - *Recommended for Render Free Tier (300 free emails/day to any recipient)*
  - **Resend REST API** (`RESEND_API_KEY`) - *HTTPS API (3,000 free emails/month)*
  - **SendGrid REST API** (`SENDGRID_API_KEY`) - *HTTPS API (100 free emails/day)*
  - **Nodemailer SMTP** (`SMTP_HOST`, `SMTP_PORT: 587`, `SMTP_USER`, `SMTP_PASS`) - *Direct Gmail / Custom SMTP for VPS or local development*
- **Auth & Security**: JWT HTTP-only cookies, Passkey / WebAuthn Biometrics, SHA-256 signed QR codes, Role-based Access Control (RBAC).

---

## ⚡ 2. Solved Issues & Troubleshooting Knowledge Base

### 🚨 Issue A: Render Free Tier Email Timeout (`ETIMEDOUT` on Port 587/465)
- **Error Log Seen on Render**:
  ```
  command: 'SENDMAIL',
  errorCode: 'ETIMEDOUT',
  errorMessage: 'SMTP operation timed out after 10000ms. (Render Free Tier blocks outbound SMTP ports 587/465)'
  ```
- **Root Cause**: Render Free Web Services completely block outbound raw TCP traffic on ports 25, 465, and 587 to prevent spam networks. Standard Nodemailer SMTP connections to `smtp.gmail.com:587` will always hang and time out.
- **Solution & Fix**:
  1. Updated `backend/src/services/emailService.js` to support HTTPS REST APIs (port 443) which are **never blocked**:
     - **Brevo API** (`https://api.brevo.com/v3/smtp/email`)
     - **Resend API** (`https://api.resend.com/emails`)
     - **SendGrid API** (`https://api.sendgrid.com/v3/mail/send`)
  2. **How the User Fixes this on Render**:
     - **Option 1 (Brevo - Recommended for sending to any email free)**:
       - Sign up free at [Brevo.com](https://www.brevo.com).
       - Get API Key from *SMTP & API* -> *API Keys*.
       - In Render Web Service Dashboard -> **Environment**:
         - Set `BREVO_API_KEY` = `xkeysib-...`
         - Set `EMAIL_FROM` = `your-email@gmail.com`
     - **Option 2 (Resend)**:
       - Sign up free at [Resend.com](https://resend.com).
       - Create API Key (`re_...`).
       - In Render Web Service Dashboard -> **Environment**:
         - Set `RESEND_API_KEY` = `re_...`
         - Set `EMAIL_FROM` = `DwarPal <onboarding@resend.dev>` (or your domain)

---

### 🔔 Issue B: IT Dashboard Real-Time Notifications & Error Telemetry
- **User Requirement**: Create a notification section in the IT dashboard where the user can get all notifications of errors and IT events perfectly fast in real time.
- **Solution & Architecture**:
  1. **WebSocket Role Room**: Added `role:it` room joining in `backend/src/services/realtimeService.js` and `notifyItStaff` in `backend/src/services/notificationService.js`.
  2. **Auto-Interception**:
     - Server 5xx errors automatically emit real-time alert with Correlation ID.
     - Email queue delivery drops automatically emit failure alerts with 1-click retry.
     - Student bulk Excel uploads with rejected rows automatically emit validation failure summaries.
  3. **Control Deck UI**: Built `src/components/ItNotificationsPanel.jsx` with category tabs (*System Errors, Upload Errors, Email Drops, Security, General*), severity filters, latency ping meter, error inspector drawer, and 1-click retry buttons.

---

## 📜 3. Chronological Changelog & Work Log

| Date | Request / Issue | Changes Made | Files Modified | Status |
| :--- | :--- | :--- | :--- | :--- |
| **2026-08-23** | **NotificationProvider Fix, Real-Time Email Sync & Batch Limit Auto-Pause** | 1. Fixed `useNotifications must be used within a NotificationProvider` crash by providing safe default fallback in `NotificationProvider.jsx` and wrapping `AdminRoute` & `ChairmanRoute` in `App.jsx`.<br>2. Implemented real-time WebSocket sync (`email:queue:event`) for email counters and individual student rows so counters update live without refreshing.<br>3. Added auto-pause worker on reaching user-defined batch limits and persisted `resendLimit` in `localStorage`.<br>4. Replaced harsh solid button gradients with refined DwarPal theme colors. | `src/components/NotificationProvider.jsx`<br>`src/App.jsx`<br>`src/components/StudentManagementPanel.jsx`<br>`src/App.css`<br>`backend/src/services/emailQueueService.js`<br>`backend/src/controllers/adminController.js`<br>`AI_CHANGELOG_AND_CONTEXT.md` | ✅ **Resolved** |
| **2026-08-23** | **IT Email Queue Controls & Bulk Resend UI Redesign** | 1. Redesigned and added rich CSS styling for Pause/Resume Worker buttons (`.it-worker-btn.pause`, `.it-worker-btn.resume`).<br>2. Fixed visibility and added counter badge styling for the Retry Failed button (`.it-retry-failed-btn`).<br>3. Overhauled Bulk Resend Onboarding Credentials card with dedicated grid layout, input styling, and high-visibility action button (`.it-bulk-resend-btn`).<br>4. Styled floating multi-select action bar. | `src/components/StudentManagementPanel.jsx`<br>`src/App.css`<br>`AI_CHANGELOG_AND_CONTEXT.md` | ✅ **Resolved** |
| **2026-08-23** | **Brevo API Key Configuration & Live Verification** | 1. Configured Brevo HTTPS email delivery in `backend/.env` with sender `dwarpal@neotech.ac.in`.<br>2. Ran live test dispatch via Brevo REST API (`POST https://api.brevo.com/v3/smtp/email`) -> Returned HTTP 201 Created and dispatched successfully.<br>3. Provided Render environment variable setup steps to the user. | `backend/.env`<br>`AI_CHANGELOG_AND_CONTEXT.md` | ✅ **Verified & Tested (201 OK)** |
| **2026-08-23** | **Resend Domain Restriction & Student Email Queue Clarification** | 1. Explained why Resend free tier fails when sending to student emails (Resend test mode `onboarding@resend.dev` only permits sending to the account owner's email unless a custom domain is verified; when Resend failed with 403, it fell back to SMTP which timed out on Render).<br>2. Documented full student creation email queue lifecycle (`createStudent` -> `sendStudentOnboardingEmail` -> `queueEmail` -> background worker pickup).<br>3. Recommended Brevo API (`BREVO_API_KEY`) as zero-domain-setup alternative for unlimited recipient delivery. | `AI_CHANGELOG_AND_CONTEXT.md`<br>`backend/src/services/emailService.js` | ✅ **Documented & Clarified** |
| **2026-08-23** | **Render Email Timeout & Master AI Handover File** | 1. Added Brevo REST API and SendGrid REST API support alongside Resend in `emailService.js`.<br>2. Updated `env.js` to parse `BREVO_API_KEY` and `SENDGRID_API_KEY`.<br>3. Updated error diagnostics and warning logs.<br>4. Created this permanent master tracking guide (`AI_CHANGELOG_AND_CONTEXT.md`). | `backend/src/services/emailService.js`<br>`backend/src/config/env.js`<br>`AI_CHANGELOG_AND_CONTEXT.md` | ✅ **Resolved** |
| **2026-08-23** | **IT Notification & Error Center** | 1. Built `ItNotificationsPanel.jsx` with real-time stream, ping latency badge, category filters, and error inspector.<br>2. Added `GET /api/admin/it-notifications`, stats, test, and clear endpoints.<br>3. Added `role:it` socket broadcasting in `realtimeService.js` and `notifyItStaff` in `notificationService.js`.<br>4. Integrated IT Notifications section (`/admin/notifications`) into `AdminPortal.jsx` & `AdminHeader`. | `src/components/ItNotificationsPanel.jsx`<br>`src/components/AdminPortal.jsx`<br>`src/lib/dwarpalApi.js`<br>`src/App.css`<br>`backend/src/controllers/adminController.js`<br>`backend/src/routes/adminRoutes.js`<br>`backend/src/services/realtimeService.js`<br>`backend/src/services/notificationService.js`<br>`backend/src/services/emailQueueService.js`<br>`backend/src/services/studentManagementService.js`<br>`backend/src/middleware/errorMiddleware.js` | ✅ **Resolved** |
| **2026-08-22** | **Email Queue Management & Resend Controls** | 1. Built `EmailManagementPanel` with worker pause/resume, queue stats, and retry buttons.<br>2. Implemented deferred email queueing in `emailQueueService.js`. | `backend/src/services/emailQueueService.js`<br>`backend/src/controllers/adminController.js`<br>`src/components/StudentManagementPanel.jsx` | ✅ **Resolved** |
| **2026-08-21** | **Batch Student Excel Upload & Error History** | 1. Added Excel/CSV student upload with GTU branch code and serial auto-generation.<br>2. Added persistent error history log and rejected rows Excel export. | `backend/src/services/studentManagementService.js`<br>`src/components/StudentManagementPanel.jsx` | ✅ **Resolved** |

---

## 🔑 4. Environment Variables Reference

### Backend (`backend/.env` & Render Dashboard)
```env
# Application
NODE_ENV=production
PORT=5000
CLIENT_URL=https://dwarpal-test.vercel.app
SERVER_URL=https://dwarpal.onrender.com

# Database
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/dwarpal?retryWrites=true&w=majority
DB_NAME=dwarpal

# Authentication & Secrets
JWT_SESSION_SECRET=your-jwt-secret-key-at-least-32-chars
COOKIE_SECRET=your-cookie-secret-key
QR_SIGN_SECRET=your-qr-signing-secret

# HTTPS Email Services (Required for Render Free Tier to bypass SMTP blocking)
# Option 1: Brevo (Recommended)
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Option 2: Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
# Option 3: SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxx

EMAIL_FROM=DwarPal <your-email@gmail.com>
SMTP_FROM_NAME=DwarPal

# Optional SMTP (Works locally or on VPS, blocked on Render Free Tier)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-gmail-app-password
```

### Frontend (`.env` & Vercel Dashboard)
```env
VITE_API_BASE_URL=https://dwarpal.onrender.com/api
```

---

## 🧭 5. Core User Roles & Navigation Routes

- **IT Admin (`/admin/*`)**:
  - `/admin/students` -> Single & Bulk Excel Student Registration
  - `/admin/student-history` -> Student Registration Logs & Credentials Export
  - `/admin/emails` -> Email Queue Management, SMTP Delivery Controls & Retries
  - `/admin/notifications` -> Real-Time IT Notification & System Error Center
  - `/admin/settings` -> System Configuration
- **Student (`/student/dashboard`)**: Apply gatepass, view status, active QR code pass.
- **Faculty / Coordinator (`/faculty/dashboard`)**: Leave applications, class gatepass approvals.
- **HOD (`/hod/dashboard`)**: Departmental gatepass approvals, faculty leave endorsements.
- **Security Guard (`/security/dashboard`)**: Gatepass QR verification, check-out/check-in logging.
- **Principal (`/principal/dashboard`)**: Campus-wide gatepass approvals and escalations.
- **CAO (`/cao/dashboard`)**: Faculty leave final approvals.
- **Chairman (`/chairman/dashboard`)**: Institutional analytics and emergency overrides.
