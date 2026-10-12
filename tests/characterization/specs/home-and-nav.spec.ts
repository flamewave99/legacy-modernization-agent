import { expect, test } from '@playwright/test';

const TITLE = 'PetClinic :: a Spring Framework demonstration';

test('welcome page shows heading, image and title', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(TITLE);
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'A cat and a dog' })).toBeVisible();
});

test('navbar links reach every top-level page', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation');

  await nav.getByRole('link', { name: 'Find owners' }).click();
  await expect(page).toHaveURL(/\/owners\/find$/);
  await expect(page.getByRole('heading', { name: 'Find Owners' })).toBeVisible();

  await nav.getByRole('link', { name: 'Veterinarians' }).click();
  await expect(page).toHaveURL(/\/vets$/);
  await expect(page.getByRole('heading', { name: 'Veterinarians' })).toBeVisible();

  await nav.getByRole('link', { name: 'Error' }).click();
  await expect(page).toHaveURL(/\/oups$/);
  await expect(page.getByRole('heading', { name: 'Something happened...' })).toBeVisible();

  await nav.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
});

test('every page keeps the same document title', async ({ page }) => {
  for (const path of ['/owners/find', '/owners/1', '/owners/new', '/vets', '/owners/1/pets/new', '/oups']) {
    await page.goto(path);
    await expect(page, path).toHaveTitle(TITLE);
  }
});
