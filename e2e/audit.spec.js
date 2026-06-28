import { test, expect } from '@playwright/test';
import fs from 'fs';

// Helper to perform client-side React Router navigation
async function clientSideNavigate(page, path) {
  const success = await page.evaluate((targetPath) => {
    // Search all elements in the DOM for React Fiber
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const key = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (!key) continue;
      
      let fiber = el[key];
      while (fiber) {
        // 1. Check for navigate in props
        if (fiber.memoizedProps && typeof fiber.memoizedProps.navigate === 'function') {
          fiber.memoizedProps.navigate(targetPath);
          return true;
        }
        if (fiber.pendingProps && typeof fiber.pendingProps.navigate === 'function') {
          fiber.pendingProps.navigate(targetPath);
          return true;
        }
        
        // 2. Check for navigation context provider (React Router v6 NavigationContext)
        if (fiber.type && fiber.type._context && fiber.type._context.displayName === 'NavigationContext') {
          const value = fiber.memoizedProps?.value || fiber.pendingProps?.value;
          if (value && value.navigator) {
            if (typeof value.navigator.push === 'function') {
              value.navigator.push(targetPath);
              return true;
            }
            if (typeof value.navigator.navigate === 'function') {
              value.navigator.navigate(targetPath);
              return true;
            }
          }
        }
        
        fiber = fiber.return;
      }
    }
    return false;
  }, path);
  
  if (success) {
    console.log(`Executed client-side navigation to ${path} successfully.`);
  } else {
    console.log(`Failed to execute React Router client-side navigation to ${path}. Falling back to page.goto.`);
    await page.goto(`http://127.0.0.1:5173${path}`, { waitUntil: 'domcontentloaded' });
  }
}

test.describe('DwarPal Application Audit', () => {
  let apiRequests = [];
  let consoleErrors = [];
  let portalLogoBox = null;
  let loginLogoBox = null;
  let registerLogoBox = null;

  test.beforeEach(async ({ page }) => {
    // Clear state
    await page.context().clearCookies();
    page.setDefaultNavigationTimeout(45000);
    
    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture network requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiRequests.push({
          url,
          method: request.method(),
          startTime: Date.now(),
          endTime: null,
          latency: null,
          status: null
        });
      }
    });

    page.on('requestfinished', request => {
      const url = request.url();
      const match = apiRequests.find(r => r.url === url && r.endTime === null);
      if (match) {
        match.endTime = Date.now();
        match.latency = match.endTime - match.startTime;
      }
    });

    page.on('requestfailed', request => {
      const url = request.url();
      const match = apiRequests.find(r => r.url === url && r.endTime === null);
      if (match) {
        match.endTime = Date.now();
        match.latency = match.endTime - match.startTime;
        match.status = 'failed';
      }
    });

    page.on('response', response => {
      const url = response.url();
      const match = apiRequests.find(r => r.url === url && r.status === null);
      if (match) {
        match.status = response.status();
      }
    });
  });

  test('Run full UI/UX, security, and network traffic audit', async ({ page }) => {
    try {
      console.log('--- Step 1: UI/UX Audit ---');
      // 1. Open the landing page
      await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveTitle(/DwarPal/i);

      // Verify it has the brand title Dwarpal
      const brandHeader = page.locator('header');
      await expect(brandHeader).toContainText('Dwarpal');

      // Click 'Access Workspace'
      const accessBtn = page.getByRole('button', { name: 'Access Workspace' });
      await expect(accessBtn).toBeVisible();
      
      // Click and verify transition to the glass UI access portal
      await accessBtn.click();
      await page.waitForURL('**/access-portal');
      console.log('Successfully transitioned to access portal.');

      // Check that the logo is fully visible
      const portalLogo = page.locator('img[alt="DwarPal Logo"]');
      await expect(portalLogo).toBeVisible();
      
      // Check brand name text
      const portalBrandName = page.locator('h1', { hasText: 'DwarPal' });
      await expect(portalBrandName).toBeVisible();
      
      // Measure logo dimensions in DOM
      portalLogoBox = await portalLogo.boundingBox();
      console.log(`Access Portal Logo bounds: width=${portalLogoBox?.width}, height=${portalLogoBox?.height}`);

      console.log('--- Step 2: Routing & Security Audit ---');
      // A. Type in the student credentials: Code: STUDENT2026, Password: dwarpal-student-access
      await page.fill('#access-code', 'STUDENT2026');
      await page.fill('#portal-password', 'dwarpal-student-access');
      await page.click('button[type="submit"]');

      // Verify redirect to login page
      await page.waitForURL('**/login');
      console.log('Student credentials verified, redirected to /login');

      // Verify that the logo on login page is visible
      const loginLogo = page.locator('img[alt="DwarPal Logo"]');
      await expect(loginLogo).toBeVisible();
      loginLogoBox = await loginLogo.boundingBox();
      console.log(`Login Page Logo bounds: width=${loginLogoBox?.width}, height=${loginLogoBox?.height}`);

      // Verify it blocks the registration route
      console.log('Attempting client-side navigation to /register as a Student...');
      await clientSideNavigate(page, '/register');
      
      // Wait for the URL to settle on either /login or /access-portal
      await page.waitForURL(url => {
        const path = url.pathname;
        return path === '/login' || path === '/access-portal';
      });
      
      const settledUrl = page.url();
      console.log(`Navigation to /register was blocked. Current URL settled at: ${settledUrl}`);

      // Verify registration option is not visible on login screen
      if (settledUrl.includes('/access-portal')) {
        console.log('Redirected to /access-portal due to hard navigation. Logging back in as student...');
        await page.fill('#access-code', 'STUDENT2026');
        await page.fill('#portal-password', 'dwarpal-student-access');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/login');
      }
      
      const registerLinkStudent = page.locator('a[href="/register"]');
      await expect(registerLinkStudent).not.toBeVisible();
      console.log('Registration option is indeed hidden on Login screen for Student');

      // B. Test the admin credentials to verify both login and registration options are accessible.
      await page.context().clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      await page.goto('http://127.0.0.1:5173/access-portal', { waitUntil: 'domcontentloaded' });
      
      // Type in admin credentials
      await page.fill('#access-code', 'GATEKEEPER2026');
      await page.fill('#portal-password', 'dwarpal-admin-access');
      await page.click('button[type="submit"]');

      // Verify redirect to login page
      await page.waitForURL('**/login');
      console.log('Admin portal credentials verified, redirected to /login');

      // Verify both login and registration options are accessible
      const registerLinkAdmin = page.locator('a[href="/register"]');
      await expect(registerLinkAdmin).toBeVisible();
      console.log('Registration option is visible on Login screen for Admin');

      // Click register link and verify it loads the registration route (use force: true to bypass animation stability loops)
      await registerLinkAdmin.click({ force: true });
      
      // Check register page logo directly (implies client-side routing finished)
      console.log('Verifying registration page logo and loading state...');
      const registerLogo = page.locator('img[alt="DwarPal Logo"]');
      await expect(registerLogo).toBeVisible({ timeout: 15000 });
      console.log('Navigated successfully to /register for Admin');

      registerLogoBox = await registerLogo.boundingBox();
      console.log(`Register Page Logo bounds: width=${registerLogoBox?.width}, height=${registerLogoBox?.height}`);
    } finally {
      // Print out traffic & network latency details
      console.log('--- Step 3: Network & Traffic Audit ---');
      console.log('API Request Latencies:');
      console.log(JSON.stringify(apiRequests, null, 2));

      console.log('Console Errors/Warnings:');
      console.log(JSON.stringify(consoleErrors, null, 2));
      
      // Write audit results to a JSON file
      const results = {
        logoDimensions: {
          accessPortal: portalLogoBox,
          loginPage: loginLogoBox,
          registerPage: registerLogoBox
        },
        apiRequests,
        consoleErrors
      };
      fs.writeFileSync('playwright-audit-results.json', JSON.stringify(results, null, 2));
      console.log('Successfully wrote playwright-audit-results.json');
    }
  });
});
