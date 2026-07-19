/**
 * portalCredentials.js — Portal access credentials for the DwarPal frontend.
 *
 * SECURITY: Credentials are loaded from environment variables ONLY.
 * They are NEVER hardcoded in this file so they cannot appear in the
 * compiled production bundle (dist/assets/*.js).
 *
 * HOW TO CONFIGURE:
 *   Development: create a `.env.local` file in the project root (already in
 *                .gitignore) with these variables:
 *
 *     VITE_STUDENT_PORTAL_ID=student-portal
 *     VITE_STUDENT_PORTAL_PASSWORD=your-dev-password
 *     VITE_FACULTY_PORTAL_ID=faculty-portal
 *     VITE_FACULTY_PORTAL_PASSWORD=your-dev-password
 *
 *   Production (Vercel): set the same variables in the Vercel dashboard under
 *                         Project → Settings → Environment Variables.
 *
 * NOTE: If a variable is missing the portal login will fail at the API level.
 * Check the backend .env for the matching STUDENT_PORTAL_ACCESS_ID /
 * FACULTY_PORTAL_ACCESS_ID values and keep them in sync.
 */

export const PORTAL_CREDENTIALS = {
  student: {
    id: import.meta.env.VITE_STUDENT_PORTAL_ID || '',
    password: import.meta.env.VITE_STUDENT_PORTAL_PASSWORD || '',
  },
  faculty: {
    id: import.meta.env.VITE_FACULTY_PORTAL_ID || '',
    password: import.meta.env.VITE_FACULTY_PORTAL_PASSWORD || '',
  },
}

export default PORTAL_CREDENTIALS
