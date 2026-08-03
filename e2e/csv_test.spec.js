import { test, expect } from '@playwright/test';

test.use({
  ignoreHTTPSErrors: true,
  baseURL: 'https://127.0.0.1:5173',
  launchOptions: {
    args: ['--disable-web-security']
  }
});

test('Verify CSV parsing logic on IT dashboard', async ({ page }) => {
  // Set generous timeout for overall page loading, navigation, and rendering
  test.setTimeout(120000);

  // Monitor network requests and responses
  page.on('request', req => {
    console.log(`[Network Request] ${req.method()} ${req.url()}`);
  });
  page.on('response', res => {
    console.log(`[Network Response] ${res.status()} ${res.url()}`);
  });

  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.text()}`);
  });

  await page.goto('https://127.0.0.1:5173/access-portal', { waitUntil: 'domcontentloaded' });

  // Handle Cookie consent if visible
  await page.click('text=Accept All', { timeout: 3000 }).catch(() => {});

  await page.fill('#access-code', 'GATEKEEPER2026');
  await page.fill('#portal-password', 'dwarpal-admin-access');
  await page.click('button[type="submit"]', { force: true });

  await page.waitForURL('**/login');
  await page.waitForTimeout(1000);

  // Dismiss Cookie Preferences again if it shows up
  await page.click('text=Accept All', { timeout: 3000 }).catch(() => {});

  // Enter IT Admin credentials
  await page.fill('#login-identifier', '105');
  await page.fill('#login-password', 'DwarPal@123');
  await page.click('button[type="submit"]', { force: true });

  // Wait for IT dashboard navigation
  await page.waitForURL('**/admin/students', { timeout: 20000 });
  console.log('Login succeeded, navigated to /admin/students');

  // Click on "Bulk Excel Upload" tab
  const bulkTab = page.locator('button', { hasText: 'Bulk Excel Upload' });
  await bulkTab.click();

  // Upload the actual CSV file
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('text=Drag & Drop Excel or CSV File Here').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles('c:\\Users\\ABC\\Documents\\dwarpal export\\student-original-data-1.csv');

  // Wait for the preview table body to appear and show rows
  const previewRows = page.locator('table tbody tr');
  await expect(previewRows.first()).toBeVisible({ timeout: 15000 });

  const count = await previewRows.count();
  console.log(`Number of preview rows displayed: ${count}`);
  expect(count).toBeGreaterThan(0);

  // Take a screenshot of the preview table to visually confirm parsed data
  await page.screenshot({ path: 'C:\\Users\\ABC\\.gemini\\antigravity\\brain\\7f54e507-f1cd-4a21-bd7d-d1f1dcbb725f\\csv-parsed-success.png' });
  console.log('Successfully captured screenshot of parsed CSV preview table.');
});
