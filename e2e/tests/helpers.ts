import { Page, expect, TestInfo } from '@playwright/test';

/**
 * Credentials come from environment variables so nothing secret is committed.
 * Run with:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... PROF_EMAIL=... PROF_PASSWORD=... npx playwright test
 */
export const CREDS = {
  admin: {
    email: process.env.ADMIN_EMAIL ?? '',
    password: process.env.ADMIN_PASSWORD ?? '',
  },
  professor: {
    email: process.env.PROF_EMAIL ?? '',
    password: process.env.PROF_PASSWORD ?? '',
  },
};

/** Collects console errors + uncaught page errors for a page. */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });
  return errors;
}

/** Save a screenshot named after the current test into screenshots/. */
export async function shot(page: Page, info: TestInfo, name?: string) {
  const safe = (name ?? info.title).replace(/[^a-z0-9]+/gi, '_').slice(0, 80);
  await page.screenshot({ path: `screenshots/${safe}.png`, fullPage: true }).catch(() => {});
}

/** Wait until the SPA has booted past the splash spinner. */
export async function waitForBoot(page: Page) {
  await page.goto('/');
  // The login card shows "High Five" + "Sign In"; the app shell shows "HIGH FIVE" brand.
  await expect(
    page.getByText(/High Five/i).first()
  ).toBeVisible({ timeout: 20_000 });
}

/** Log in via the LoginScreen. role only flips the cosmetic toggle. */
export async function login(page: Page, role: 'admin' | 'professor') {
  const c = CREDS[role];
  if (!c.email || !c.password) {
    throw new Error(
      `Missing credentials for "${role}". Set ${role === 'admin' ? 'ADMIN_EMAIL/ADMIN_PASSWORD' : 'PROF_EMAIL/PROF_PASSWORD'}.`
    );
  }
  await waitForBoot(page);

  // Click the role toggle (cosmetic, but mirrors a real user).
  const toggle = page.getByText(role === 'admin' ? 'Administrator' : 'Professor', { exact: true }).first();
  await toggle.click().catch(() => {});

  await page.getByPlaceholder('you@university.edu').fill(c.email);
  await page.getByPlaceholder('••••••••').fill(c.password);
  await page.getByText('Sign In', { exact: true }).click();

  // Logged in when the workspace sidebar brand appears.
  await expect(page.getByText('WORKSPACE', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

/** Click a sidebar nav item by its visible label (first match = the sidebar row). */
export async function navTo(page: Page, label: string) {
  await page.getByText(label, { exact: true }).first().click();
  await page.waitForTimeout(800); // let the drawer screen swap render
}

/** True if the LoginScreen is currently shown (logged out). */
export async function isLoggedOut(page: Page) {
  return page.getByText('Sign In', { exact: true }).isVisible().catch(() => false);
}
