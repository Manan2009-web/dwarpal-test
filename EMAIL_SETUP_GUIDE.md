# DwarPal Email Verification Setup Guide

## Overview

The DwarPal authentication system now supports real email verification with three delivery methods in priority order:

1. **Gmail SMTP** (Recommended) - Most reliable, free with Google account
2. **Resend API** - Professional email service with free tier
3. **Console Mode** (Development only) - For testing without email setup

---

## 🔧 Setup Instructions

### Option A: Gmail SMTP (Recommended for Development & Production)

#### Step 1: Enable Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled:
   - Click "2-Step Verification" on the left
   - Follow the setup process
3. Generate **App Password**:
   - After 2-Step is enabled, click "App passwords"
   - Select "Mail" and "Windows Computer" (or your device type)
   - Google generates a 16-character password
   - Copy this password (you'll use it in .env)

#### Step 2: Install Dependencies

```bash
cd backend
npm install
```

#### Step 3: Configure Environment Variables

Create or edit `backend/.env`:

```env
# Email Delivery Configuration
EMAIL_DELIVERY_MODE=auto
EMAIL_FROM=your-email@gmail.com

# Gmail SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
```

**Important Notes:**
- `SMTP_USER`: Your full Gmail address (e.g., `john.doe@gmail.com`)
- `SMTP_PASS`: The 16-character app password generated above (spaces included)
- `SMTP_PORT`: Use **587** for TLS or **465** for SSL
- `SMTP_SECURE`: Set to `false` for port 587, `true` for port 465
- `EMAIL_FROM`: Must be your Gmail address (cannot be arbitrary sender)

#### Step 4: Test Configuration

Start the backend and register a test account:

```bash
npm run dev
```

You should receive a verification email at the registered address within seconds.

---

### Option B: Resend API (Professional Email Service)

#### Step 1: Create Resend Account

1. Go to [Resend.com](https://resend.com)
2. Sign up for free account
3. Go to API Keys section
4. Create a new API key and copy it

#### Step 2: Configure Environment Variables

Create or edit `backend/.env`:

```env
EMAIL_DELIVERY_MODE=auto
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=DwarPal <onboarding@resend.dev>
```

**Important Notes:**
- You must use your Resend domain in `EMAIL_FROM`
- Free tier includes `onboarding@resend.dev`
- For production, use your custom domain

---

### Option C: Console Mode (Development Only)

To test without email sending (emails print to terminal):

```bash
# Set this in backend/.env
EMAIL_DELIVERY_MODE=console
```

This will print verification codes to the backend console instead of sending emails. **Do NOT use in production.**

---

## 🔌 Email Delivery Priority

The system automatically selects the email delivery method in this order:

1. **SMTP** - If `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are configured
2. **Resend** - If `RESEND_API_KEY` and `EMAIL_FROM` are configured
3. **Console** - If in development and neither above is configured
4. **Error** - In production, if none of the above are configured

### Auto-Detection Example

```env
# This will use SMTP (highest priority)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

---

## 📧 Email Features

### Registration Verification Email
- **Recipient**: User's registered email
- **Contains**: 6-digit verification code, DwarPal branding
- **Expires**: 10 minutes (configurable)
- **Can Resend**: After 60 seconds (configurable)

### Password Reset Email
- **Recipient**: Account email
- **Contains**: Reset token, reset link
- **Expires**: 15 minutes (configurable)
- **Single Use**: Token expires after use

---

## ✅ Testing Checklist

### 1. Registration Flow
- [ ] Navigate to `/register`
- [ ] Fill registration form completely
- [ ] Click "Create Account"
- [ ] Verification email received within 5 seconds
- [ ] Email contains 6-digit code
- [ ] Enter code in verification modal
- [ ] Click "Verify"
- [ ] Redirected to `/login` page
- [ ] Success message: "Registration successful! Please sign in with your credentials."
- [ ] Sign in with new credentials
- [ ] Dashboard loads with correct role

### 2. Email Content
- [ ] Verify email contains DwarPal branding
- [ ] Code is clearly visible
- [ ] Expiry time mentioned (10 minutes)
- [ ] Professional formatting maintained
- [ ] Links are clickable if present

### 3. Verification Code Behavior
- [ ] Code valid for 10 minutes
- [ ] Invalid code shows error
- [ ] Expired code shows error
- [ ] Max 5 attempts per code
- [ ] "Resend OTP" button cooldown (60 seconds)
- [ ] Resent code works properly

### 4. Error Handling
- [ ] Network error → Clear error message
- [ ] Invalid email → Validation error
- [ ] Duplicate email → "Already registered" message
- [ ] SMTP misconfiguration → 503 Server error with clear message

### 5. Forgot Password Flow
- [ ] Click "Forgot Password?" on login
- [ ] Enter email
- [ ] Password reset email received
- [ ] Reset link opens in browser
- [ ] New password saved
- [ ] Can log in with new password

### 6. Phone Number Field
- [ ] Phone field present in registration
- [ ] No "DwarPal now verifies email instead" helper text
- [ ] Phone number NOT required for email verification
- [ ] Phone saved in user profile
- [ ] No phone OTP sent

### 7. Dashboard After Login
- [ ] Student sees student dashboard
- [ ] Faculty sees faculty dashboard
- [ ] HOD sees HOD dashboard
- [ ] Security sees security dashboard
- [ ] CAO sees CAO dashboard
- [ ] Principal sees principal dashboard

---

## 🔍 Troubleshooting

### Email Not Received

**Gmail SMTP:**
- [ ] Verify 2-Step Verification is enabled
- [ ] Verify App Password is correct (16 characters with spaces)
- [ ] Check spam folder
- [ ] Try `SMTP_PORT=465` with `SMTP_SECURE=true`
- [ ] Check backend logs for SMTP errors

**Resend:**
- [ ] Verify API key is valid
- [ ] Verify EMAIL_FROM matches Resend domain
- [ ] Check backend logs for API errors

**General:**
- [ ] Check `EMAIL_DELIVERY_MODE=auto` is set
- [ ] Restart backend after .env changes
- [ ] Check no Twilio/SMS configuration remains

### "Email Delivery Not Configured" Error (503)

This means:
- In production mode, no email service is configured
- Must set EITHER SMTP OR Resend credentials
- In development, will fall back to console mode

### "Too Many Attempts" Error (429)

- User exceeded 5 verification attempts
- User must request new code
- Code expires after 10 minutes anyway

---

## 📝 Environment Variables Reference

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `EMAIL_DELIVERY_MODE` | No | `auto` | Force specific mode (console/resend) |
| `SMTP_HOST` | For SMTP | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | For SMTP | `587` | SMTP server port |
| `SMTP_SECURE` | For SMTP | `false` | Use TLS (false at 587, true at 465) |
| `SMTP_USER` | For SMTP | `user@gmail.com` | SMTP authentication username |
| `SMTP_PASS` | For SMTP | `xxxx xxxx xxxx xxxx` | SMTP authentication password |
| `RESEND_API_KEY` | For Resend | `re_xxxx...xxxx` | Resend API key |
| `EMAIL_FROM` | For email | `admin@example.com` | Sender email address |

---

## 🚀 Production Deployment

### Recommended Setup

1. **Use Gmail SMTP with dedicated account**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=noreply@yourdomain.com
   SMTP_PASS=your-app-password
   EMAIL_FROM=DwarPal <noreply@yourdomain.com>
   ```

2. **Or use Resend API**
   ```env
   RESEND_API_KEY=re_xxxxxxxx
   EMAIL_FROM=DwarPal <noreply@yourdomain.com>
   ```

3. **Configure in production environment variables, NOT in .env file**

4. **Test email flow before going live**

5. **Monitor email delivery in logs**

---

## 📞 Support

For issues with email delivery:

1. Check backend logs: `npm run dev`
2. Verify .env configuration
3. Test with console mode first: `EMAIL_DELIVERY_MODE=console`
4. Check email provider status (Gmail, Resend)
5. Verify network connectivity from server

---

## ✨ Key Changes Summary

✅ **Real Email Sending**: No more console-only emails  
✅ **Gmail SMTP Support**: Professional, reliable, free  
✅ **Fallback Options**: Resend API and console for dev  
✅ **No Phone OTP**: Phone field exists, no verification  
✅ **Login After Register**: User redirects to login, not auto-dashboard  
✅ **Secure Verification**: 6-digit code, 10-minute expiry, 5-attempt limit  
✅ **Forgot Password Works**: Uses same email infrastructure  
✅ **DwarPal Theme**: All emails maintain DwarPal branding
