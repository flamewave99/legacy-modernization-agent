import { expect, test } from '@playwright/test';

// Legacy renders handled exceptions with a friendly page but HTTP 200 (SimpleMappingExceptionResolver).
// Container-level errors (unknown route, bad path variable) use the servlet container's own page,
// so only their status codes are pinned here, not their HTML.

test('/oups shows the friendly error page with the exception message (HTTP 200)', async ({ page }) => {
  const response = await page.goto('/oups');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Something happened...' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'A cat and a dog' })).toBeVisible();
  await expect(page.locator('body')).toContainText(
    'Expected: controller used to showcase what happens when an exception is thrown',
  );
});

test('unknown owner id shows the friendly error page (HTTP 200)', async ({ page }) => {
  const response = await page.goto('/owners/999999');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Something happened...' })).toBeVisible();
});

test('unknown path returns 404', async ({ request }) => {
  const response = await request.get('/no-such-page');
  expect(response.status()).toBe(404);
});

test('non-numeric owner id returns 400', async ({ request }) => {
  const response = await request.get('/owners/abc');
  expect(response.status()).toBe(400);
});
