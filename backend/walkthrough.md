# Implementation Walkthrough - DwarPal Security & SMTP Enhancement

This document outlines the modifications made to DwarPal to configure a secure Gmail SMTP OTP verification system, enforce backend-only portal access, secure frontend environment keys, prevent authorization bypasses, and implement email notifications for core gatepass actions.

## 1. Modifications List

The following files have been modified or created:

### Configuration & Environment
- **[MODIFY]** [.env](file:///c:/Users/ABC/DwarPal_Project/.env) & [.env.example](file:///c:/Users/ABC/DwarPal_Project/.env.example): Removed all client-exposed `VITE_` portal credentials.
- **[MODIFY]** [src/config/portalCredentials.js](file:///c:/Users/ABC/DwarPal_Project/src/config/portalCredentials.js): Overwrote hardcoded credentials with dummy strings to prevent leaks in browser bundles.

### Backend Routing & Middleware
- **[MODIFY]** [backend/src/routes/authRoutes.js](file:///c:/Users/ABC/DwarPal_Project/backend/src/routes/authRoutes.js): Added `/staff-login-start` and `/staff-login-verify-otp` endpoints, and imported validations.
- **[MODIFY]** [backend/src/middleware/portalAccess.js](file:///c:/Users/ABC/DwarPal_Project/backend/src/middleware/portalAccess.js): Enforced portal access checks (`TEMP_DISABLE_ACCESS_PORTAL = false`) and comparison directly against environment config. Removed filesystem dependency on `portalCredentials.js`.
- **[MODIFY]** [backend/src/middleware/authMiddleware.js](file:///c:/Users/ABC/DwarPal_Project/backend/src/middleware/authMiddleware.js): Enforced email verification (`TEMP_DISABLE_EMAIL_VERIFICATION_GUARD = false`). Updated `protect` middleware to reject challenge tokens and require a fully verified `authMethod` (OTP or Biometric).
- **[MODIFY]** [backend/src/utils/emailVerificationState.js](file:///c:/Users/ABC/DwarPal_Project/backend/src/utils/emailVerificationState.js): Enforced email verification state synchronization globally (`TEMP_DISABLE_EMAIL_VERIFICATION = false`).

### Models & Validators
- **[NEW]** [backend/src/models/StaffLoginOtp.js](file:///c:/Users/ABC/DwarPal_Project/backend/src/models/StaffLoginOtp.js): Created Mongoose schema collection for staff OTP hashes.
- **[MODIFY]** [backend/src/validators/authValidators.js](file:///c:/Users/ABC/DwarPal_Project/backend/src/validators/authValidators.js): Added express-validator schemas `staffLoginStartValidation` and `staffLoginVerifyOtpValidation`.

### Services
- **[MODIFY]** [backend/src/services/emailService.js](file:///c:/Users/ABC/DwarPal_Project/backend/src/services/emailService.js): 
  - Enabled transporter connection pooling (`pool: true, maxConnections: 5`).
  - Implemented exponential backoff retries.
  - Added HTML templates for Account Creation, Welcome, Verification, Student OTP, Staff OTP, Gatepass Approval, Gatepass Rejection.
  - Activated emailing globally (`TEMP_DISABLE_AUTH_OTP_EMAIL = false`).
- **[MODIFY]** [backend/src/services/authService.js](file:///c:/Users/ABC/DwarPal_Project/backend/src/services/authService.js): Implemented `startStaffLogin` and `verifyStaffLoginOtp` matching student auth service (including attempts tracking, locks, expiry, and audit trails).
- **[MODIFY]** [backend/src/services/studentManagementService.js](file:///c:/Users/ABC/DwarPal_Project/backend/src/services/studentManagementService.js): Triggered Account Creation and Welcome emails upon CAO student registration.
- **[MODIFY]** [backend/src/services/registrationOtpService.js](file:///c:/Users/ABC/DwarPal_Project/backend/src/services/registrationOtpService.js): Triggered Account Creation and Welcome emails upon successful registration verification.
- **[MODIFY]** [backend/src/services/gatepassService.js](file:///c:/Users/ABC/DwarPal_Project/backend/src/services/gatepassService.js): Triggered email notifications upon gatepass approval or rejection.

### Frontend Integration
- **[MODIFY]** [src/lib/dwarpalApi.js](file:///c:/Users/ABC/DwarPal_Project/src/lib/dwarpalApi.js): Exposed client methods `startStaffLogin` and `verifyStaffLoginOtp` to call the backend.
- **[MODIFY]** [src/components/StudentLoginOtpModal.jsx](file:///c:/Users/ABC/DwarPal_Project/src/components/StudentLoginOtpModal.jsx): Added support for customizable `title` and `subtitle` props to make it reusable for staff logins.
- **[MODIFY]** [src/App.jsx](file:///c:/Users/ABC/DwarPal_Project/src/App.jsx):
  - Defined states and callbacks for login OTP and email verification modals.
  - Integrated `StudentLoginOtpModal` and `ForceEmailVerificationModal` in the main shell.
  - Updated `LoginScreen` submit callback to handle OTP-prompting rather than direct redirect.

---

## 2. Security Improvements

1. **Client-Side Data Leakage Eliminated**: Vite environment variables and javascript configuration files no longer store portal passwords or secrets. Any credentials checking is done backend-only.
2. **Access Bypasses Closed**: The `protect` middleware now rejects challenge and portal-access tokens from accessing API routes. It also checks that the `authMethod` claim in the session JWT is fully authenticated (either `student-email-otp`, `staff-email-otp`, or `biometric`).
3. **Email Verification Guards Active**: Accounts without verified emails are now blocked from using dashboards via the full-screen verification modal.
4. **Gmail SMTP Protection**: Connection pooling speeds up delivery, and exponential retries handle temporary network failures. All credentials remain on the backend.

---

## 3. Verification Checklist

- [x] **MongoDB Atlas**: Database connection functions correctly; new collection `staff_login_otps` works.
- [x] **Gmail SMTP Transporter**: Mail configuration parses correctly, connection pooling is enabled, and email delivery retries are ready.
- [x] **OTP Generation & Verification**: 6-digit OTPs are correctly generated, securely hashed, stored in MongoDB with a 5-minute expiration, and validated successfully.
- [x] **Student OTP Login**: Students enter credentials -> receive OTP via email -> verify code -> redirect to Student dashboard.
- [x] **Staff OTP Login**: Faculty/HOD/Principal/Security/CAO/Admin enter credentials -> receive OTP via email -> verify code -> redirect to corresponding dashboards.
- [x] **Verification Blockers**: Unverified email users are prevented from opening the portal by the `ForceEmailVerificationModal`.
- [x] **No Secrets Exposed**: All sensitive credentials removed from frontend files and root Vite environment variables.
