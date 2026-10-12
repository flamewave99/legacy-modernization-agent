import { expect, test, type Page } from '@playwright/test';
import { addPet, createOwner, field, fillDate, petIds } from '../support/helpers';

// Known legacy defects, pinned so the decision to keep or fix them is explicit.
// Excluded by default (see playwright.config.ts); run with INCLUDE_LEGACY_BUGS=1.

async function addVisit(page: Page, ownerId: number, petId: number, date: string, description: string) {
  await page.goto(`/owners/${ownerId}/pets/${petId}/visits/new`);
  await fillDate(field(page, 'date'), date);
  await field(page, 'description').fill(description);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Add Visit' }).click(),
  ]);
  expect(response.status()).toBe(302);
}

// Visit.date has no required rule, so a blank date is saved as NULL. Pet.getVisits() sorts by date
// with a null-hostile comparator; Java skips sorting lists of fewer than 2, so the crash needs a
// second visit on the same pet.
test('@legacy-bug empty visit date is accepted; owner page still renders while it is the only visit', async ({ page }) => {
  const { id } = await createOwner(page);
  await addPet(page, id, { name: 'Nodate', birthDate: '2020/01/01', type: 'cat' });
  const [petId] = await petIds(page, id);
  await addVisit(page, id, petId as number, '', 'visit without date');
  const ownerPage = await page.request.get(`/owners/${id}`);
  expect(ownerPage.status()).toBe(200);
  expect(await ownerPage.text()).toContain('visit without date');
});

test('@legacy-bug empty visit date plus any other visit on the pet makes the owner page 500', async ({ page }) => {
  const { id } = await createOwner(page);
  await addPet(page, id, { name: 'Nodate', birthDate: '2020/01/01', type: 'cat' });
  const [petId] = await petIds(page, id);
  await addVisit(page, id, petId as number, '2021/01/01', 'dated visit');
  await addVisit(page, id, petId as number, '', 'visit without date');
  const ownerPage = await page.request.get(`/owners/${id}`);
  expect(ownerPage.status()).toBe(500);
});

test('@legacy-bug a rejected owner edit re-renders as "New Owner" with an "Add Owner" button', async ({ page }) => {
  const { id } = await createOwner(page);
  await page.goto(`/owners/${id}/edit`);
  await field(page, 'lastName').fill('');
  await page.getByRole('button', { name: 'Update Owner' }).click();
  await expect(page.getByRole('heading', { name: 'New Owner' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Owner' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/owners/${id}/edit$`));
});

test('@legacy-bug the visits list route has no view and returns 404', async ({ request }) => {
  const response = await request.get('/owners/1/pets/1/visits');
  expect(response.status()).toBe(404);
});

test('@legacy-bug editing a pet id that does not exist returns 500', async ({ request }) => {
  const response = await request.get('/owners/1/pets/999999/edit');
  expect(response.status()).toBe(500);
});

test('@legacy-bug unknown pet type leaks a Java conversion error message', async ({ page }) => {
  const { id } = await createOwner(page);
  const response = await page.request.post(`/owners/${id}/pets/new`, {
    form: { name: 'Typo', birthDate: '2020/01/01', type: 'dragon' },
  });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Failed to convert property value of type 'java.lang.String'");
});
