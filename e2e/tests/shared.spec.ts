import { test, expect } from '@playwright/test';
import { login, navTo, collectErrors, shot, waitForBoot, CREDS } from './helpers';

/**
 * SHARED / SYSTEM TESTS (33–40).
 */
test.describe('Shared / System', () => {
  test('33 App does not crash on refresh', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'admin');
    await page.reload();
    await page.waitForTimeout(2500);
    // After reload the session persists (Supabase + localStorage) or returns to login —
    // either is a non-crash. Assert one of them rendered and no uncaught page error.
    await expect(page.getByText(/WORKSPACE|Sign In/).first()).toBeVisible({ timeout: 20000 });
    const fatal = errors.filter(e => e.startsWith('[pageerror]'));
    expect(fatal, `Uncaught errors on refresh: ${fatal.join(' | ')}`).toHaveLength(0);
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('34 Protected content not shown when logged out', async ({ page }, info) => {
    const errors = collectErrors(page);
    await waitForBoot(page); // fresh context = no session
    await expect(page.getByText('Sign In', { exact: true }).first()).toBeVisible();
    // No app shell / sidebar workspace should be present while logged out.
    await expect(page.getByText('WORKSPACE', { exact: true })).toHaveCount(0);
    await shot(page, info);
    console.log('NOTE: app has no URL routing — protected screens are unreachable without an in-memory session.');
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('35 Logout works for admin', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'admin');
    await page.getByText('Log out', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await expect(page.getByText('Sign In', { exact: true }).first()).toBeVisible();
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('36 Logout works for professor', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await page.getByText('Log out', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await expect(page.getByText('Sign In', { exact: true }).first()).toBeVisible();
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('37 Wrong credentials show an error', async ({ page }, info) => {
    const errors = collectErrors(page);
    await waitForBoot(page);
    await page.getByPlaceholder('you@university.edu').fill('definitely-not-real@example.com');
    await page.getByPlaceholder('••••••••').fill('wrong-password-123');
    await page.getByText('Sign In', { exact: true }).click();
    // Supabase returns an auth error rendered in red below the form.
    await expect(
      page.getByText(/Invalid|credential|failed|incorrect|error/i).first()
    ).toBeVisible({ timeout: 15000 });
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('38 Professor-only pages hidden from admin', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'admin');
    // Homework Assistance + Course Management + Course Overview + Warnings are professor-only.
    await expect(page.getByText('Homework Assistance', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Course Overview', { exact: true })).toHaveCount(0);
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('39 Admin-only pages hidden from professor', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    // Open Day + Statistics + Student Coordination + Tasks are admin-only.
    await expect(page.getByText('Open Day', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Student Coordination', { exact: true })).toHaveCount(0);
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('40 Supabase-connected pages load without blank screens / console errors', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'admin');
    const pages: Array<[string, RegExp]> = [
      ['Statistics', /Course Enrollment Stats/i],
      ['Student Coordination', /Student Risk Overview|Risk Limit Settings/i],
      ['Open Day', /Open Day Program|Event Settings/i],
      ['News', /News|Latest/i],
    ];
    for (const [label, expected] of pages) {
      await navTo(page, label);
      await expect(page.getByText(expected).first(), `${label} rendered no content (blank screen)`).toBeVisible();
    }
    await shot(page, info, '40_supabase_pages');
    const fatal = errors.filter(e => e.startsWith('[pageerror]'));
    expect(fatal, `Uncaught errors across Supabase pages: ${fatal.join(' | ')}`).toHaveLength(0);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });
});
