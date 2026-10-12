import { expect, test } from '@playwright/test';
import { createOwner, field, fieldContainer } from '../support/helpers';

// Seed owners as rendered in the owners list: name | address | city | telephone | pets (sorted by name).
const SEED_OWNERS: Array<[string, string, string, string, string]> = [
  ['George Franklin', '110 W. Liberty St.', 'Madison', '6085551023', 'Leo'],
  ['Betty Davis', '638 Cardinal Ave.', 'Sun Prairie', '6085551749', 'Basil'],
  ['Eduardo Rodriquez', '2693 Commerce St.', 'McFarland', '6085558763', 'Jewel Rosy'],
  ['Harold Davis', '563 Friendly St.', 'Windsor', '6085553198', 'Iggy'],
  ['Peter McTavish', '2387 S. Fair Way', 'Madison', '6085552765', 'George'],
  ['Jean Coleman', '105 N. Lake St.', 'Monona', '6085552654', 'Max Samantha'],
  ['Jeff Black', '1450 Oak Blvd.', 'Monona', '6085555387', 'Lucky'],
  ['Maria Escobito', '345 Maple St.', 'Madison', '6085557683', 'Mulligan'],
  ['David Schroeder', '2749 Blackhawk Trail', 'Madison', '6085559435', 'Freddy'],
  ['Carlos Estaban', '2335 Independence La.', 'Waunakee', '6085555487', 'Lucky Sly'],
];

test('find owners form has a last name field, a search button and an add-owner link', async ({ page }) => {
  await page.goto('/owners/find');
  await expect(page.getByRole('heading', { name: 'Find Owners' })).toBeVisible();
  await expect(field(page, 'lastName')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find Owner' })).toBeVisible();
  await page.getByRole('link', { name: 'Add Owner' }).click();
  await expect(page).toHaveURL(/\/owners\/new$/);
});

test('empty search lists all owners with address, city, telephone and pets', async ({ page }) => {
  await page.goto('/owners/find');
  await page.getByRole('button', { name: 'Find Owner' }).click();
  await expect(page).toHaveURL(/\/owners\?lastName=$/);
  await expect(page.getByRole('heading', { name: 'Owners' })).toBeVisible();

  const header = page.locator('thead tr');
  await expect(header.locator('th')).toHaveText(['Name', 'Address', 'City', 'Telephone', 'Pets']);

  for (const [name, address, city, telephone, pets] of SEED_OWNERS) {
    const row = page.locator('tbody tr', { has: page.getByRole('link', { name, exact: true }) });
    await expect(row.locator('td')).toHaveText([name, address, city, telephone, pets]);
  }
});

test('seed owners are listed in id order before owners added later', async ({ page }) => {
  await page.goto('/owners?lastName=');
  const names = await page.locator('tbody tr td:first-child').allInnerTexts();
  expect(names.slice(0, SEED_OWNERS.length).map((n) => n.trim())).toEqual(SEED_OWNERS.map((o) => o[0]));
});

test('owner name in the list links to the owner details page', async ({ page }) => {
  await page.goto('/owners?lastName=');
  await page.getByRole('link', { name: 'Jean Coleman', exact: true }).click();
  await expect(page).toHaveURL(/\/owners\/6$/);
  await expect(page.getByRole('heading', { name: 'Owner Information' })).toBeVisible();
});

test('a search matching several owners shows the list', async ({ page }) => {
  await page.goto('/owners/find');
  await field(page, 'lastName').fill('Davis');
  await page.getByRole('button', { name: 'Find Owner' }).click();
  await expect(page).toHaveURL(/\/owners\?lastName=Davis$/);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Betty Davis' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Harold Davis' })).toBeVisible();
});

test('a search matching exactly one owner redirects to that owner', async ({ page }) => {
  await page.goto('/owners/find');
  await field(page, 'lastName').fill('Franklin');
  await page.getByRole('button', { name: 'Find Owner' }).click();
  await expect(page).toHaveURL(/\/owners\/1$/);
  await expect(page.getByRole('heading', { name: 'Owner Information' })).toBeVisible();
});

test('search is a case-insensitive prefix match on last name', async ({ page }) => {
  await page.goto('/owners?lastName=dav');
  await expect(page.locator('tbody tr')).toHaveCount(2);

  await page.goto('/owners?lastName=FRANK');
  await expect(page).toHaveURL(/\/owners\/1$/);

  // Substring that is not a prefix does not match.
  await page.goto('/owners?lastName=avis');
  await expect(page.getByRole('heading', { name: 'Find Owners' })).toBeVisible();
});

test('a search with no match stays on the find form with "has not been found"', async ({ page }) => {
  await page.goto('/owners/find');
  await field(page, 'lastName').fill('Zzznotanowner');
  await page.getByRole('button', { name: 'Find Owner' }).click();
  await expect(page).toHaveURL(/\/owners\?lastName=Zzznotanowner$/);
  await expect(page.getByRole('heading', { name: 'Find Owners' })).toBeVisible();
  await expect(field(page, 'lastName')).toHaveValue('Zzznotanowner');
  await expect(fieldContainer(page, 'lastName')).toContainText('has not been found');
});

test('GET /owners without a lastName parameter lists all owners', async ({ page }) => {
  await page.goto('/owners');
  await expect(page.getByRole('heading', { name: 'Owners' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'George Franklin' })).toBeVisible();
});

test('a newly created owner is found by its last name', async ({ page }) => {
  const { id, owner } = await createOwner(page);
  await page.goto('/owners/find');
  await field(page, 'lastName').fill(owner.lastName);
  await page.getByRole('button', { name: 'Find Owner' }).click();
  await expect(page).toHaveURL(new RegExp(`/owners/${id}$`));
});
