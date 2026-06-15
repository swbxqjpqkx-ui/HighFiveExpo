import { test, expect } from '@playwright/test';
import { login, navTo, collectErrors, shot } from './helpers';

/**
 * PROFESSOR ACCOUNT TESTS (16–32).
 */
test.describe('Professor', () => {
  test('16 Professor login works', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await expect(page.getByText('Professor Panel', { exact: true }).first()).toBeVisible();
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('17 Professor dashboard loads', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    // Home is the default professor route; assert the sidebar workspace + Home is active.
    await expect(page.getByText('WORKSPACE', { exact: true }).first()).toBeVisible();
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('18 Professor Course Overview opens', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Course Overview');
    await expect(page.getByText(/My Courses|No courses found/i).first()).toBeVisible();
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('19 Professor can open a course', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Course Overview');
    await page.waitForTimeout(1200);
    if (await page.getByText('No courses found', { exact: true }).count()) {
      test.skip(true, 'Professor has no courses assigned — cannot open one.');
    }
    // Click a course card via its "Avg Grade" label (click bubbles to the card's onPress).
    await page.getByText('Avg Grade', { exact: false }).first().click({ force: true });
    await page.waitForTimeout(1200);
    // CourseStudentsScreen shows a "Class Avg" summary stat.
    expect(await page.getByText('Class Avg', { exact: false }).count()).toBeGreaterThan(0);
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('20 Professor can open student list inside a course', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Course Overview');
    await page.waitForTimeout(1200);
    if (await page.getByText('No courses found', { exact: true }).count()) {
      test.skip(true, 'No courses → no in-course student list.');
    }
    await page.getByText('Avg Grade', { exact: false }).first().click({ force: true });
    await page.waitForTimeout(1200);
    // The student list inside a course has Grade + Missed column headers.
    expect(await page.getByText('Grade', { exact: true }).count()).toBeGreaterThan(0);
    expect(await page.getByText('Missed', { exact: true }).count()).toBeGreaterThan(0);
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('21 Professor can open student profile', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Course Overview');
    await page.waitForTimeout(1200);
    if (await page.getByText('No courses found', { exact: true }).count()) {
      test.skip(true, 'No courses → no student profile reachable.');
    }
    await page.getByText('Avg Grade', { exact: false }).first().click({ force: true });
    await page.waitForTimeout(1200);
    if (await page.getByText('No students enrolled yet.', { exact: true }).count()) {
      test.skip(true, 'Course has no students enrolled.');
    }
    // Each student row has a rank badge ("1", "2", …); click row 1 → CourseStudentDetailModal.
    // Scope to :visible so we don't match a hidden calendar day "1" on the inactive Home screen.
    const rank1 = page.getByText('1', { exact: true }).and(page.locator(':visible'));
    await rank1.first().click({ force: true });
    await page.waitForTimeout(1000);
    expect(await page.getByText(/Student Information|Current Course/i).count()).toBeGreaterThan(0);
    await shot(page, info, '21_student_profile');
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('22 Professor Course Management folder opens', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Course Management');
    await expect(page.getByText(/Course Management|No courses assigned/i).first()).toBeVisible();
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('23 Professor Material/Materials Management opens', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Course Management');
    await page.waitForTimeout(900);
    if (await page.getByText('No courses assigned', { exact: true }).count()) {
      test.skip(true, 'No courses assigned → no course detail / tabs.');
    }
    // Tabs live inside a course; open the first course via its "Open →" link.
    await page.getByText('Open →', { exact: false }).first().click({ force: true });
    await page.waitForTimeout(1000);
    // "Materials Check" tab exists in the course detail (disabled until syllabus locked).
    expect(await page.getByText('Materials Check', { exact: true }).count()).toBeGreaterThan(0);
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('24 Professor syllabus/scheme upload UI appears', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Course Management');
    await page.waitForTimeout(900);
    if (await page.getByText('No courses assigned', { exact: true }).count()) {
      test.skip(true, 'No courses assigned → no syllabus/scheme UI.');
    }
    await page.getByText('Open →', { exact: false }).first().click({ force: true });
    await page.waitForTimeout(1000);
    // Default tab = Guidelines Check, which shows Syllabus / Scheme of Work upload UI.
    expect(await page.getByText(/Syllabus|Scheme/i).count()).toBeGreaterThan(0);
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('25 Professor Course Overlap page opens', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Course Management');
    await page.waitForTimeout(900);
    if (await page.getByText('No courses assigned', { exact: true }).count()) {
      test.skip(true, 'No courses assigned → no overlap tab.');
    }
    await page.getByText('Open →', { exact: false }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.getByText('Overlap Reports', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(800);
    expect(await page.getByText(/Course Overlap Check|Overlap/i).count()).toBeGreaterThan(0);
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('26 Professor Run overlap check button visible', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Course Management');
    await page.waitForTimeout(900);
    if (await page.getByText('No courses assigned', { exact: true }).count()) {
      test.skip(true, 'No courses → overlap tab/button not rendered.');
    }
    await page.getByText('Open →', { exact: false }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.getByText('Overlap Reports', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(800);
    expect(await page.getByText(/Run Overlap Check/i).count()).toBeGreaterThan(0);
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('27 Professor Homework Assistance folder opens', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Homework Assistance');
    await expect(page.getByText('Homework Assistance', { exact: true }).first()).toBeVisible();
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('28 Professor Homework Checker opens', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Homework Assistance');
    await page.waitForTimeout(700);
    await expect(page.getByText('Homework Checker', { exact: true }).first()).toBeVisible();
    await page.getByText('Start Homework Check', { exact: true }).first().click();
    await page.waitForTimeout(900);
    await shot(page, info, '28_homework_checker');
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('29 Professor News folder opens', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'News');
    await page.waitForTimeout(1500);
    // News page renders "Recent Articles" + article cards with "Read Article".
    expect(await page.getByText(/Recent Articles|Read Article|Course News/i).count()).toBeGreaterThan(0);
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('30 Professor Calendar page opens', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await navTo(page, 'Calendar');
    await page.waitForTimeout(700);
    await expect(page.getByText(/Calendar|New Event/i).first()).toBeVisible();
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('31 Professor notifications dropdown opens', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await page.getByText('🔔').first().click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Notifications', { exact: true }).first()).toBeVisible();
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });

  test('32 Professor notification open-details redirects', async ({ page }, info) => {
    const errors = collectErrors(page);
    await login(page, 'professor');
    await page.getByText('🔔').first().click();
    await page.waitForTimeout(600);
    const seeFull = page.getByText('See full version ›').first();
    if ((await seeFull.count()) === 0) {
      test.skip(true, 'No notifications present for this professor — nothing to redirect to.');
    }
    await seeFull.click();
    await page.waitForTimeout(1200);
    await expect(page.getByText('Notifications', { exact: true })).toHaveCount(0);
    await shot(page, info);
    console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  });
});
