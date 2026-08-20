import { test, expect } from '@playwright/test';
import path from 'path';

test.use({
  ignoreHTTPSErrors: true,
  baseURL: 'https://localhost:5173',
  viewport: { width: 375, height: 667 }, // iPhone SE size
});

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(120000); // 120s timeout for each test
});

async function bypassCookieBannerAndToasts(page) {
  try {
    await page.addStyleTag({
      content: `
        .cookie-consent-banner,
        .notification-toast-stack,
        .notification-toast,
        aside[aria-label="Cookie preferences"],
        [class*="cookie-consent"],
        [id*="cookie-consent"] {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          height: 0 !important;
          width: 0 !important;
          opacity: 0 !important;
        }
      `
    });
  } catch (e) {}
}

async function loginAsStudent(page) {
  console.log('Logging in as student...');
  await page.goto('/access-portal', { waitUntil: 'domcontentloaded' });
  await bypassCookieBannerAndToasts(page);
  await page.waitForTimeout(500);

  await page.fill('#access-code', 'STUDENT2026');
  await page.fill('#portal-password', 'dwarpal-student-access');
  await page.click('button[type="submit"]');

  await page.waitForSelector('#login-identifier', { state: 'visible' });
  await bypassCookieBannerAndToasts(page);
  await page.fill('#login-identifier', '249590307012');
  await page.fill('#login-password', 'Manan@2009');
  await page.click('button[type="submit"]');

  await page.waitForURL(url => url.pathname.includes('/dashboard'), { timeout: 30000 });
  await page.waitForTimeout(1500);
  await bypassCookieBannerAndToasts(page);
}

test('1. Student Dashboard Screen', async ({ page }) => {
  await loginAsStudent(page);
  await page.screenshot({ path: path.join(process.cwd(), 'e2e-screenshots/mobile_student_dashboard.png') });
});

test('2. Student Sidebar Navigation Screen', async ({ page }) => {
  await loginAsStudent(page);
  await page.click('button.hamburger-button');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(process.cwd(), 'e2e-screenshots/mobile_student_sidebar.png') });
});

test('3. Create Gatepass Modal Screen', async ({ page }) => {
  await loginAsStudent(page);
  await page.click('button.action-button.primary:has-text("New Gatepass")');
  await page.waitForSelector('textarea[placeholder*="explain why"]', { state: 'visible', timeout: 15000 });
  await page.screenshot({ path: path.join(process.cwd(), 'e2e-screenshots/mobile_gatepass_modal.png') });
});

test('4. Notifications Panel Screen', async ({ page }) => {
  await loginAsStudent(page);
  await page.click('button.notification-toggle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(process.cwd(), 'e2e-screenshots/mobile_notifications_panel.png') });
});

test('5. Principal Dashboard Screen', async ({ page }) => {
  console.log('Logging in as principal...');
  await page.goto('/access-portal', { waitUntil: 'domcontentloaded' });
  await bypassCookieBannerAndToasts(page);
  await page.waitForTimeout(500);

  await page.fill('#access-code', 'GATEKEEPER2026');
  await page.fill('#portal-password', 'dwarpal-admin-access');
  await page.click('button[type="submit"]');

  await page.waitForSelector('#login-identifier', { state: 'visible' });
  await bypassCookieBannerAndToasts(page);
  await page.fill('#login-identifier', '100');
  await page.fill('#login-password', 'Manan@2009');
  await page.click('button[type="submit"]');

  await page.waitForURL(url => url.pathname.includes('/dashboard'), { timeout: 30000 });
  await page.waitForTimeout(1500);
  await bypassCookieBannerAndToasts(page);
  await page.screenshot({ path: path.join(process.cwd(), 'e2e-screenshots/mobile_principal_dashboard.png') });
});

test('6. Security Dashboard Screen', async ({ page }) => {
  console.log('Logging in as security...');
  await page.goto('/access-portal', { waitUntil: 'domcontentloaded' });
  await bypassCookieBannerAndToasts(page);
  await page.waitForTimeout(500);

  await page.fill('#access-code', 'GATEKEEPER2026');
  await page.fill('#portal-password', 'dwarpal-admin-access');
  await page.click('button[type="submit"]');

  await page.waitForSelector('#login-identifier', { state: 'visible' });
  await bypassCookieBannerAndToasts(page);
  await page.fill('#login-identifier', '103');
  await page.fill('#login-password', 'Manan@2009');
  await page.click('button[type="submit"]');

  await page.waitForURL(url => url.pathname.includes('/security') || url.pathname.includes('/dashboard'), { timeout: 30000 });
  await page.waitForTimeout(1500);
  await bypassCookieBannerAndToasts(page);
  await page.screenshot({ path: path.join(process.cwd(), 'e2e-screenshots/mobile_security_dashboard.png') });
});
