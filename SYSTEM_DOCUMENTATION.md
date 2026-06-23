# DwarPal System Documentation

## User Enrollment, Email Verification, and Access Portal Logic

---

## Overview

DwarPal is a digital gatepass and access management platform that provides secure user management, role-based access control, email verification, OTP authentication, and gatepass approval workflows. The system is designed to ensure that only authorized users can access institutional resources while maintaining accountability and security across all operations.

---

## User Enrollment System

### Role-Based Enrollment Architecture

DwarPal follows a controlled enrollment model where different user roles are onboarded through different methods.

### Student Enrollment Process

Students cannot register directly through the public registration page.

Instead, student accounts are created and managed by authorized administrators through the Admin Dashboard.

#### Student Creation Workflow

1. Admin accesses the Student Management section.
2. Admin enters student details:
   * Full Name
   * Enrollment Number
   * Email Address
   * Department
   * Course
   * Academic Year
   * Contact Information
3. System validates all submitted information.
4. Duplicate records are checked.
5. Student account is created in the database.
6. Login credentials are generated or assigned.
7. Student receives an email containing account information and access instructions.

This approach prevents unauthorized registrations and ensures that only officially enrolled students can access the platform.

### Staff Registration Process

Authorized institutional users such as:

* Faculty
* HOD
* Principal
* Security Staff
* Admin
* CAO

can be registered according to the institution's configuration and authorization policies.

All registration requests are validated before account creation.

---

## Student Enrollment Validation

During student creation, DwarPal verifies:

* Unique enrollment number
* Unique email address
* Department assignment
* Valid academic information
* Existing account conflicts

If validation fails, account creation is rejected and appropriate error messages are displayed.

---

## Student Account Activation

Once a student account is created:

1. Account details are stored securely.
2. Passwords are encrypted using secure hashing algorithms.
3. Student receives a welcome email.
4. Student logs in using assigned credentials.
5. Additional email verification may be required depending on institutional settings.

---

## Email Verification Logic

### Account Verification

After account creation or registration:

1. DwarPal generates a verification token.
2. Verification information is linked to the user account.
3. Verification email is sent to the registered email address.
4. User confirms ownership of the email account.
5. Account status changes to Verified.

### Verification Security

The verification process includes:

* Unique verification tokens
* Expiration limits
* Single-use validation
* Protection against duplicate verification attempts

---

## Login OTP Verification System

### Protected Account Authentication

To increase security, DwarPal can require OTP verification for privileged roles including:

* Owner
* Admin
* Principal
* HOD

### Login Workflow

1. User enters email and password.
2. Credentials are verified.
3. System generates a secure OTP.
4. OTP is delivered to the registered email address.
5. User enters the OTP code.
6. OTP validity and expiration are checked.
7. Secure login session is created.

### OTP Security Features

* Random code generation
* Time-based expiration
* Single-use verification
* Retry limitations
* Automatic invalidation after successful login

---

## Email Communication System

DwarPal uses email services to automate communication between users and the platform.

### Student Emails

Students may receive:

* Account creation notifications
* Welcome emails
* Login OTP codes
* Password reset emails
* Gatepass approval notifications
* Gatepass rejection notifications
* Status update notifications

### Administrative Emails

Administrators and staff may receive:

* Login verification codes
* Security alerts
* Approval notifications
* System activity alerts
* Account management notifications

---

## Password Recovery Workflow

### Reset Request

1. User selects Forgot Password.
2. User enters registered email.
3. Reset token is generated.
4. Password reset email is sent.

### Password Update

1. User opens reset link.
2. Token validity is verified.
3. New password is submitted.
4. Password is securely updated.
5. Previous sessions may be terminated for security purposes.

---

## Access Portal Architecture

### Student Portal

Students can:

* Submit gatepass requests
* Track request status
* View approval history
* Receive notifications
* Manage profile information

### Faculty Portal

Faculty members can:

* Review student requests
* Approve or reject requests
* Monitor student activity

### HOD Portal

HOD users can:

* Review departmental requests
* Monitor department-level records
* Generate reports

### Principal Portal

Principals can:

* Access institution-wide request data
* Review escalated requests
* Monitor overall system activity

### Security Portal

Security personnel can:

* Verify gatepasses
* Monitor exits and entries
* Validate gatepass authenticity
* Track movement records

### Admin Portal

Administrators can:

* Create student accounts
* Manage users
* Manage departments
* Configure permissions
* Access analytics
* Monitor system activity

### Owner Portal

The Owner role has complete platform control, including:

* Full user management
* Role management
* System configuration
* Analytics and reporting
* Security monitoring
* Administrative oversight

---

## Security and Audit System

DwarPal maintains detailed activity records including:

* Student account creation
* User registrations
* Login attempts
* OTP verifications
* Password reset requests
* Gatepass approvals
* Gatepass rejections
* Administrative actions
* Role modifications

These logs help maintain transparency, accountability, and institutional security throughout the platform.

---

## Related Documentation

- [README.md](README.md) - Project overview and quick start
- [QUICK_START.md](QUICK_START.md) - Authentication implementation quick reference
- [EMAIL_SETUP_GUIDE.md](EMAIL_SETUP_GUIDE.md) - Email verification setup guide
- [SECURITY_NOTES.md](SECURITY_NOTES.md) - Security configuration notes
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Authentication fixes implementation summary
- [COMPLETE_IMPLEMENTATION_REPORT.md](COMPLETE_IMPLEMENTATION_REPORT.md) - Complete implementation report

---

**Last Updated**: June 18, 2026  
**Status**: Active Documentation
