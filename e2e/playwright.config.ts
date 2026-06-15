import { defineConfig, devices } from '@playwright/test';

/**
 * High Five — isolated Playwright config.
 * Serves the prebuilt static web export (../dist) and tests it in Chromium.
 * Does NOT touch the app. Read-only behavioural testing.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,        // single backend (live Supabase) — keep it gentle
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'results.json' }],
    ['html', { open: 'never', outputFolder: 'report' }],
  ],
  use: {
    baseURL: 'http://localhost:8080',
    viewport: { width: 1366, height: 900 }, // ≥1024 → permanent drawer (sidebar always visible)
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 12_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'python3 -m http.server 8080 --directory ../dist',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
