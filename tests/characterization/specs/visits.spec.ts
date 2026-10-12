import { expect, test } from '@playwright/test';
import { addPet, aroundToday, createOwner, field, fieldContainer, fillDate, pageText, petIds } from '../support/helpers';

async function ownerWithPet(page: import('@playwright/test').Page) {
  const { id, owner } = await createOwner(page);
  await addPet(page, id, { name: 'Visitor', birthDate: '2017/07/08', type: 'lizard' });
  const [petId] = await petIds(page, id);
  return { id, owner, petId: petId as number };
}

test('new visit form shows the pet, today\'s date and previous visits', async ({ page }) => {
  await page.goto('/owners/6');
  await page.getByRole('link', { name: 'Add Visit' }).first().click();
  await expect(page).toHaveURL(/\/owners\/6\/pets\/8\/visits\/new$/);
  await expect(page.getByRole('heading', { name: 'New Visit' })).toBeVisible();

  const text = await pageText(page);
  expect(text).toContain('Name Birth Date Type Owner Max 2012/09/04 cat Jean Coleman');
  expect(text).toContain('Previous Visits Date Description 2013/01/03 neutered 2013/01/02 rabies shot');

  // Server renders today as yyyy/MM/dd; the browser date widget (flatpickr) shows yyyy-MM-dd.
  await expect(field(page, 'date')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  expect(aroundToday()).toContain(await field(page, 'date').inputValue());
  await expect(field(page, 'description')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Add Visit' })).toBeVisible();
});

test('pets on the owner page link "Add Visit" in pet name order', async ({ page }) => {
  await page.goto('/owners/6');
  const hrefs = await page.getByRole('link', { name: 'Add Visit' }).evaluateAll((links) =>
    links.map((a) => a.getAttribute('href')),
  );
  expect(hrefs).toEqual(['/owners/6/pets/8/visits/new', '/owners/6/pets/7/visits/new']);
});

test('valid visit is saved and shown on the owner page, newest first', async ({ page }) => {
  const { id, petId } = await ownerWithPet(page);
  for (const [date, description] of [['2021/02/03', 'first checkup'], ['2022/04/05', 'second checkup']]) {
    await page.goto(`/owners/${id}/pets/${petId}/visits/new`);
    await fillDate(field(page, 'date'), date as string);
    await field(page, 'description').fill(description as string);
    await page.getByRole('button', { name: 'Add Visit' }).click();
    await expect(page).toHaveURL(new RegExp(`/owners/${id}$`));
  }
  expect(await pageText(page)).toContain(
    'Name Visitor Birth Date 2017-07-08 Type lizard Visit Date Description 2022-04-05 second checkup 2021-02-03 first checkup',
  );

  await page.goto(`/owners/${id}/pets/${petId}/visits/new`);
  expect(await pageText(page)).toContain('Previous Visits Date Description 2022/04/05 second checkup 2021/02/03 first checkup');
});

test('submitting with the pre-filled date saves a visit dated today', async ({ page }) => {
  const { id, petId } = await ownerWithPet(page);
  await page.goto(`/owners/${id}/pets/${petId}/visits/new`);
  const today = await field(page, 'date').inputValue();
  await field(page, 'description').fill('same day');
  await page.getByRole('button', { name: 'Add Visit' }).click();
  await expect(page).toHaveURL(new RegExp(`/owners/${id}$`));
  expect(await pageText(page)).toContain(`${today} same day`);
});

test('visit date is also accepted as yyyy-MM-dd', async ({ page }) => {
  const { id, petId } = await ownerWithPet(page);
  await page.goto(`/owners/${id}/pets/${petId}/visits/new`);
  await fillDate(field(page, 'date'), '2023-08-09');
  await field(page, 'description').fill('dashed date');
  await page.getByRole('button', { name: 'Add Visit' }).click();
  await expect(page).toHaveURL(new RegExp(`/owners/${id}$`));
  expect(await pageText(page)).toContain('2023-08-09 dashed date');
});

test('empty description is rejected with "must not be empty"', async ({ page }) => {
  const { id, petId } = await ownerWithPet(page);
  await page.goto(`/owners/${id}/pets/${petId}/visits/new`);
  await page.getByRole('button', { name: 'Add Visit' }).click();
  await expect(page).toHaveURL(new RegExp(`/owners/${id}/pets/${petId}/visits/new$`));
  await expect(page.getByRole('heading', { name: 'New Visit' })).toBeVisible();
  await expect(fieldContainer(page, 'description')).toContainText('must not be empty');
  await expect(fieldContainer(page, 'date')).not.toContainText('invalid date');
});

test('invalid visit date shows "invalid date"', async ({ page }) => {
  const { id, petId } = await ownerWithPet(page);
  await page.goto(`/owners/${id}/pets/${petId}/visits/new`);
  await fillDate(field(page, 'date'), '31/31/2020');
  await field(page, 'description').fill('bad date');
  await page.getByRole('button', { name: 'Add Visit' }).click();
  await expect(fieldContainer(page, 'date')).toContainText('invalid date');
  await expect(field(page, 'description')).toHaveValue('bad date');
});

test('an invalid date and empty description are reported together', async ({ page }) => {
  const { id, petId } = await ownerWithPet(page);
  await page.goto(`/owners/${id}/pets/${petId}/visits/new`);
  await fillDate(field(page, 'date'), 'abc');
  await page.getByRole('button', { name: 'Add Visit' }).click();
  await expect(fieldContainer(page, 'date')).toContainText('invalid date');
  await expect(fieldContainer(page, 'description')).toContainText('must not be empty');
});
