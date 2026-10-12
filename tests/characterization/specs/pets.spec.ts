import { expect, test } from '@playwright/test';
import { addPet, createOwner, field, fieldContainer, fillDate, pageText, petIds } from '../support/helpers';

const PET_TYPES = ['bird', 'cat', 'dog', 'hamster', 'lizard', 'snake'];

test.describe('add pet', () => {
  test('new pet form shows owner, empty fields and pet types in name order', async ({ page }) => {
    const { id, owner } = await createOwner(page);
    await page.getByRole('link', { name: 'Add New Pet' }).click();
    await expect(page).toHaveURL(new RegExp(`/owners/${id}/pets/new$`));
    await expect(page.getByRole('heading', { name: 'New Pet' })).toBeVisible();
    await expect(page.locator('body')).toContainText(`${owner.firstName} ${owner.lastName}`);
    await expect(field(page, 'name')).toHaveValue('');
    await expect(field(page, 'birthDate')).toHaveValue('');
    await expect(field(page, 'type').locator('option')).toHaveText(PET_TYPES);
    await expect(page.getByRole('button', { name: 'Add Pet' })).toBeVisible();
  });

  test('valid pet is added and shown on the owner page', async ({ page }) => {
    const { id } = await createOwner(page);
    await addPet(page, id, { name: 'Biscuit', birthDate: '2019/03/04', type: 'hamster' });
    expect(await pageText(page)).toContain('Name Biscuit Birth Date 2019-03-04 Type hamster');
  });

  test('birth date is also accepted as yyyy-MM-dd', async ({ page }) => {
    const { id } = await createOwner(page);
    await addPet(page, id, { name: 'Dashy', birthDate: '2018-12-25', type: 'dog' });
    expect(await pageText(page)).toContain('Name Dashy Birth Date 2018-12-25 Type dog');
  });

  test('a future birth date is accepted', async ({ page }) => {
    const { id } = await createOwner(page);
    await addPet(page, id, { name: 'Futura', birthDate: '2099/01/01', type: 'bird' });
    expect(await pageText(page)).toContain('Name Futura Birth Date 2099-01-01 Type bird');
  });

  test('pets are listed by name, case-insensitively', async ({ page }) => {
    const { id } = await createOwner(page);
    await addPet(page, id, { name: 'charlie', birthDate: '2020/01/01', type: 'cat' });
    await addPet(page, id, { name: 'Alpha', birthDate: '2020/01/01', type: 'cat' });
    await addPet(page, id, { name: 'bravo', birthDate: '2020/01/01', type: 'cat' });
    const text = await pageText(page);
    const order = ['Alpha', 'bravo', 'charlie'].map((n) => text.indexOf(`Name ${n} `));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test('all fields empty: name, birth date and type are required', async ({ page }) => {
    const { id } = await createOwner(page);
    await page.goto(`/owners/${id}/pets/new`);
    await page.getByRole('button', { name: 'Add Pet' }).click();
    await expect(page).toHaveURL(new RegExp(`/owners/${id}/pets/new$`));
    await expect(page.getByRole('heading', { name: 'New Pet' })).toBeVisible();
    for (const name of ['name', 'birthDate', 'type']) {
      await expect(fieldContainer(page, name)).toContainText('is required');
    }
  });

  test('invalid birth date shows "invalid date"', async ({ page }) => {
    const { id } = await createOwner(page);
    await page.goto(`/owners/${id}/pets/new`);
    await field(page, 'name').fill('Wrongdate');
    await fillDate(field(page, 'birthDate'), 'notadate');
    await field(page, 'type').selectOption('cat');
    await page.getByRole('button', { name: 'Add Pet' }).click();
    await expect(fieldContainer(page, 'birthDate')).toContainText('invalid date');
    await expect(field(page, 'name')).toHaveValue('Wrongdate');
  });

  test('duplicate pet name for the same owner is rejected, ignoring case', async ({ page }) => {
    const { id } = await createOwner(page);
    await addPet(page, id, { name: 'Rex', birthDate: '2020/01/01', type: 'dog' });
    await page.goto(`/owners/${id}/pets/new`);
    await field(page, 'name').fill('rEX');
    await fillDate(field(page, 'birthDate'), '2021/01/01');
    await field(page, 'type').selectOption('dog');
    await page.getByRole('button', { name: 'Add Pet' }).click();
    await expect(fieldContainer(page, 'name')).toContainText('is already in use');
    expect(await petIds(page, id)).toHaveLength(1);
  });

  test('the same pet name is allowed for different owners', async ({ page }) => {
    const a = await createOwner(page);
    const b = await createOwner(page);
    await addPet(page, a.id, { name: 'Twin', birthDate: '2020/01/01', type: 'dog' });
    await addPet(page, b.id, { name: 'Twin', birthDate: '2020/01/01', type: 'dog' });
  });
});

test.describe('edit pet', () => {
  test('edit form is pre-filled, titled "Pet", with "Update Pet" button', async ({ page }) => {
    await page.goto('/owners/1');
    await page.getByRole('link', { name: 'Edit Pet' }).click();
    await expect(page).toHaveURL(/\/owners\/1\/pets\/1\/edit$/);
    await expect(page.getByRole('heading', { name: 'Pet', exact: true })).toBeVisible();
    await expect(page.locator('body')).toContainText('George Franklin');
    await expect(field(page, 'name')).toHaveValue('Leo');
    // Server renders 2010/09/07; the browser date widget (flatpickr) reformats it on load.
    await expect(field(page, 'birthDate')).toHaveValue('2010-09-07');
    await expect(field(page, 'type')).toHaveValue('cat');
    await expect(page.getByRole('button', { name: 'Update Pet' })).toBeVisible();
  });

  test('saving changes updates the pet on the owner page', async ({ page }) => {
    const { id } = await createOwner(page);
    await addPet(page, id, { name: 'Before', birthDate: '2015/05/05', type: 'cat' });
    const [petId] = await petIds(page, id);
    await page.goto(`/owners/${id}/pets/${petId}/edit`);
    await field(page, 'name').fill('After');
    await fillDate(field(page, 'birthDate'), '2016/06/06');
    await field(page, 'type').selectOption('snake');
    await page.getByRole('button', { name: 'Update Pet' }).click();
    await expect(page).toHaveURL(new RegExp(`/owners/${id}$`));
    const text = await pageText(page);
    expect(text).toContain('Name After Birth Date 2016-06-06 Type snake');
    expect(text).not.toContain('Name Before ');
    expect(await petIds(page, id)).toEqual([petId]);
  });

  test('submitting the edit form unchanged succeeds', async ({ page }) => {
    const { id } = await createOwner(page);
    await addPet(page, id, { name: 'Same', birthDate: '2015/05/05', type: 'dog' });
    const [petId] = await petIds(page, id);
    await page.goto(`/owners/${id}/pets/${petId}/edit`);
    await page.getByRole('button', { name: 'Update Pet' }).click();
    await expect(page).toHaveURL(new RegExp(`/owners/${id}$`));
    expect(await pageText(page)).toContain('Name Same Birth Date 2015-05-05 Type dog');
  });

  test('empty name and birth date are required on edit', async ({ page }) => {
    const { id } = await createOwner(page);
    await addPet(page, id, { name: 'Editme', birthDate: '2015/05/05', type: 'cat' });
    const [petId] = await petIds(page, id);
    await page.goto(`/owners/${id}/pets/${petId}/edit`);
    await field(page, 'name').fill('');
    await fillDate(field(page, 'birthDate'), '');
    await page.getByRole('button', { name: 'Update Pet' }).click();
    await expect(page.getByRole('heading', { name: 'Pet', exact: true })).toBeVisible();
    await expect(fieldContainer(page, 'name')).toContainText('is required');
    await expect(fieldContainer(page, 'birthDate')).toContainText('is required');
  });

  test('renaming a pet to another pet\'s name of the same owner is NOT rejected', async ({ page }) => {
    const { id } = await createOwner(page);
    await addPet(page, id, { name: 'Alpha', birthDate: '2015/05/05', type: 'cat' });
    await addPet(page, id, { name: 'Beta', birthDate: '2015/05/05', type: 'cat' });
    const [, betaId] = await petIds(page, id);
    await page.goto(`/owners/${id}/pets/${betaId}/edit`);
    await field(page, 'name').fill('Alpha');
    await page.getByRole('button', { name: 'Update Pet' }).click();
    await expect(page).toHaveURL(new RegExp(`/owners/${id}$`));
    expect((await pageText(page)).match(/Name Alpha /g)).toHaveLength(2);
  });
});
