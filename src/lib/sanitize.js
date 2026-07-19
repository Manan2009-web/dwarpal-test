/**
 * sanitize.js — Client-side input sanitization helpers for DwarPal.
 *
 * PURPOSE
 *   These utilities are a defence-in-depth measure on top of the server's
 *   express-validator rules. They catch obvious XSS strings and oversized
 *   inputs before they even leave the browser, giving immediate user feedback.
 *
 *   The server-side validators remain the authoritative source of truth —
 *   never rely solely on client-side validation for security.
 *
 * USAGE
 *   import { sanitizeText, sanitizeName, validateEmail, trimInput } from '../lib/sanitize'
 */

/**
 * Strip characters that are meaningful in HTML/JS contexts.
 * Safe to use on any freeform text field (reason, destination, remarks, etc.).
 *
 * Removes: < > & " ' ` = /
 * Returns a trimmed, max-length-capped string.
 *
 * @param {*} value     - Raw input value (any type).
 * @param {number} maxLength - Maximum allowed character length (default 500).
 * @returns {string}
 */
export function sanitizeText(value, maxLength = 500) {
  return String(value ?? '')
    .replace(/[<>&"'`=\/]/g, '')   // strip HTML-sensitive chars
    .trim()
    .slice(0, maxLength)
}

/**
 * Sanitize a human name field.
 * Allows letters, spaces, hyphens, apostrophes, and dots — blocks everything
 * else that would be unusual in a name and could indicate injection.
 *
 * @param {*} value
 * @param {number} maxLength - Default 120 (matches the DB schema maxlength).
 * @returns {string}
 */
export function sanitizeName(value, maxLength = 120) {
  return String(value ?? '')
    .replace(/[^A-Za-z\s'\-\.]/g, '')
    .replace(/\s{2,}/g, ' ')       // collapse consecutive whitespace
    .trim()
    .slice(0, maxLength)
}

/**
 * Trim whitespace from a generic input without altering its content.
 * Use this for IDs, enrollment numbers, employee IDs, OTPs.
 *
 * @param {*} value
 * @returns {string}
 */
export function trimInput(value) {
  return String(value ?? '').trim()
}

/**
 * Simple email format validator (not a definitive check — the server validates
 * via express-validator's isEmail, this is just for fast UX feedback).
 *
 * @param {string} value
 * @returns {boolean}
 */
export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? '').trim())
}

/**
 * Password strength checker — mirrors the backend PASSWORD_REGEX:
 *   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/
 *
 * Returns an object with `valid` boolean and a `message` to show the user.
 *
 * @param {string} value
 * @returns {{ valid: boolean, message: string }}
 */
export function validatePasswordStrength(value) {
  const password = String(value ?? '')

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters.' }
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' }
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' }
  }

  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number.' }
  }

  if (!/[^A-Za-z\d]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character.' }
  }

  return { valid: true, message: '' }
}

/**
 * Validate an Indian enrollment number or employee ID.
 * Blocks values that contain script-injection characters.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function validateIdentifier(value) {
  const clean = trimInput(value)
  if (!clean) return false
  // Must not contain HTML-injection characters
  return !/[<>&"'`=]/.test(clean)
}
