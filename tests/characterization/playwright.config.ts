import { defineConfig, devices } from '@playwright/test';

// Same suite runs against legacy (default) and modern: BASE_URL=http://localhost:3000 npx playwright test
const baseURL = process.env.BASE_URL ?? 'http://localhost:8080';

// Tests tagged @legacy-bug pin down known legacy defects (see SPEC.md "Known legacy defects").
// They are excluded by default so the modern app is not forced to reproduce crashes;
// set INCLUDE_LEGACY_BUGS=1 to run them.
const includeLegacyBugs = process.env.INCLUDE_LEGACY_BUGS === '1';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  grepInvert: includeLegacyBugs ? undefined : /@legacy-bug/,
  use: {
    baseURL,
    // Validation messages are locale-dependent (messages_de/es exist); pin English.
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en-US' },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
