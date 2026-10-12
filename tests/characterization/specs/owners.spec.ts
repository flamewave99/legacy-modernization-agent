import { expect, test } from '@playwright/test';
import { createOwner, field, fieldContainer, fillOwnerForm, infoRow, linkTarget, newOwnerData } from '../support/helpers';

const OWNER_FIELDS = ['firstName', 'lastName', 'address', 'city', 'telephone'] as const;
const TELEPHONE_ERROR = 'numeric value out of bounds (<10 digits>.<0 digits> expected)';

test.describe('owner details', () => {
  test('shows owner information, action links and pets for a seed owner', async ({ page }) => {
    await page.goto('/owners/1');
    await expect(page.getByRole('heading', { name: 'Owner Information' })).toBeVisible();
    await expect(infoRow(page, 'Name').locator('td')).toHaveText('George Franklin');
    await expect(infoRow(page, 'Address').locator('td')).toHaveText('110 W. Liberty St.');
    await expect(infoRow(page, 'City').locator('td')).toHaveText('Madison');
    await expect(infoRow(page, 'Telephone').locator('td')).toHaveText('6085551023');

    expect(await linkTarget(page.getByRole('link', { name: 'Edit Owner' }))).toBe('/owners/1/edit');
    expect(await linkTarget(page.getByRole('link', { name: 'Add New Pet' }))).toBe('/owners/1/pets/new');

    await expect(page.getByRole('heading', { name: 'Pets and Visits' })).toBeVisible();
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(text).toContain('Name Leo Birth Date 2010-09-07 Type cat');
    expect(await linkTarget(page.getByRole('link', { name: 'Edit Pet' }))).toBe('/owners/1/pets/1/edit');
    expect(await linkTarget(page.getByRole('link', { name: 'Add Visit' }))).toBe('/owners/1/pets/1/visits/new');
  });

  test('lists each pet with its visits, newest visit first', async ({ page }) => {
    await page.goto('/owners/6');
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(text).toContain(
      'Name Max Birth Date 2012-09-04 Type cat Visit Date Description 2013-01-03 neutered 2013-01-02 rabies shot',
    );
    expect(text).toContain(
      'Name Samantha Birth Date 2012-09-04 Type cat Visit Date Description 2013-01-04 spayed 2013-01-01 rabies shot',
    );
    expect(text.indexOf('Max')).toBeLessThan(text.indexOf('Samantha'));
  });

  test('output is HTML-escaped', async ({ page }) => {
    const { id } = await createOwner(page, { firstName: '<b>Bold</b>', address: '<script>x</script>' });
    await page.goto(`/owners/${id}`);
    await expect(infoRow(page, 'Name').locator('td')).toContainText('<b>Bold</b>');
    await expect(infoRow(page, 'Address').locator('td')).toHaveText('<script>x</script>');
  });
});

test.describe('add owner', () => {
  test('new owner form is empty with "New Owner" heading and "Add Owner" button', async ({ page }) => {
    await page.goto('/owners/new');
    await expect(page.getByRole('heading', { name: 'New Owner' })).toBeVisible();
    for (const name of OWNER_FIELDS) await expect(field(page, name)).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Add Owner' })).toBeVisible();
  });

  test('valid owner is saved and shown on its details page', async ({ page }) => {
    const owner = newOwnerData({ firstName: 'Ada', address: '12 Byron Rd.', city: 'London', telephone: '0123456789' });
    await page.goto('/owners/new');
    await fillOwnerForm(page, owner);
    await page.getByRole('button', { name: 'Add Owner' }).click();
    await expect(page).toHaveURL(/\/owners\/\d+$/);
    await expect(infoRow(page, 'Name').locator('td')).toHaveText(`Ada ${owner.lastName}`);
    await expect(infoRow(page, 'Address').locator('td')).toHaveText('12 Byron Rd.');
    await expect(infoRow(page, 'City').locator('td')).toHaveText('London');
    await expect(infoRow(page, 'Telephone').locator('td')).toHaveText('0123456789');
  });

  test('all fields empty: every field reports an error and nothing is saved', async ({ page }) => {
    await page.goto('/owners/new');
    await page.getByRole('button', { name: 'Add Owner' }).click();
    await expect(page).toHaveURL(/\/owners\/new$/);
    await expect(page.getByRole('heading', { name: 'New Owner' })).toBeVisible();
    for (const name of ['firstName', 'lastName', 'address', 'city']) {
      await expect(fieldContainer(page, name)).toContainText('must not be empty');
    }
    // Empty telephone violates both @NotEmpty and @Digits. Legacy shows one of the two, and which
    // one varies per request (unordered violation set), so either is accepted. See NOTES.md.
    await expect(fieldContainer(page, 'telephone')).toContainText(
      new RegExp(`must not be empty|${TELEPHONE_ERROR.replace(/[.()<>]/g, '\\$&')}`),
    );
  });

  test('entered values are kept when the form is re-shown with errors', async ({ page }) => {
    await page.goto('/owners/new');
    await fillOwnerForm(page, { firstName: 'Kept', lastName: 'Values', address: 'Somewhere', city: '', telephone: 'abc' });
    await page.getByRole('button', { name: 'Add Owner' }).click();
    await expect(field(page, 'firstName')).toHaveValue('Kept');
    await expect(field(page, 'telephone')).toHaveValue('abc');
    await expect(fieldContainer(page, 'city')).toContainText('must not be empty');
    await expect(fieldContainer(page, 'firstName')).not.toContainText('must not be empty');
  });

  for (const telephone of ['abc', '12345678901', '123-456']) {
    test(`telephone "${telephone}" is rejected`, async ({ page }) => {
      await page.goto('/owners/new');
      await fillOwnerForm(page, newOwnerData({ telephone }));
      await page.getByRole('button', { name: 'Add Owner' }).click();
      await expect(page).toHaveURL(/\/owners\/new$/);
      await expect(fieldContainer(page, 'telephone')).toContainText(TELEPHONE_ERROR);
    });
  }

  for (const telephone of ['1', '1234567890']) {
    test(`telephone "${telephone}" (1 to 10 digits) is accepted`, async ({ page }) => {
      const { id } = await createOwner(page, { telephone });
      expect(id).toBeGreaterThan(0);
    });
  }

  test('whitespace-only first name is accepted (not trimmed)', async ({ page }) => {
    const { id } = await createOwner(page, { firstName: ' ' });
    await page.goto(`/owners/${id}`);
    await expect(page.getByRole('heading', { name: 'Owner Information' })).toBeVisible();
  });
});

test.describe('edit owner', () => {
  test('edit form is pre-filled, titled "Owner", with "Update Owner" button', async ({ page }) => {
    const { id, owner } = await createOwner(page);
    await page.getByRole('link', { name: 'Edit Owner' }).click();
    await expect(page).toHaveURL(new RegExp(`/owners/${id}/edit$`));
    await expect(page.getByRole('heading', { name: 'Owner', exact: true })).toBeVisible();
    for (const name of OWNER_FIELDS) await expect(field(page, name)).toHaveValue(owner[name]);
    await expect(page.getByRole('button', { name: 'Update Owner' })).toBeVisible();
  });

  test('saving changes redirects to the owner page with new values', async ({ page }) => {
    const { id } = await createOwner(page);
    await page.goto(`/owners/${id}/edit`);
    await fillOwnerForm(page, { address: '99 Changed Ave.', city: 'Newtown', telephone: '1112223333' });
    await page.getByRole('button', { name: 'Update Owner' }).click();
    await expect(page).toHaveURL(new RegExp(`/owners/${id}$`));
    await expect(infoRow(page, 'Address').locator('td')).toHaveText('99 Changed Ave.');
    await expect(infoRow(page, 'City').locator('td')).toHaveText('Newtown');
    await expect(infoRow(page, 'Telephone').locator('td')).toHaveText('1112223333');
  });

  test('invalid edit is rejected and the change is not saved', async ({ page }) => {
    const { id, owner } = await createOwner(page);
    await page.goto(`/owners/${id}/edit`);
    await fillOwnerForm(page, { lastName: '', telephone: 'x' });
    await page.getByRole('button', { name: 'Update Owner' }).click();
    await expect(fieldContainer(page, 'lastName')).toContainText('must not be empty');
    await expect(page).toHaveURL(new RegExp(`/owners/${id}/edit$`));
    await expect(fieldContainer(page, 'telephone')).toContainText(TELEPHONE_ERROR);

    await page.goto(`/owners/${id}`);
    await expect(infoRow(page, 'Name').locator('td')).toHaveText(`${owner.firstName} ${owner.lastName}`);
  });

  test('editing keeps the owner\'s pets', async ({ page }) => {
    await page.goto('/owners/1/edit');
    await page.getByRole('button', { name: 'Update Owner' }).click();
    await expect(page).toHaveURL(/\/owners\/1$/);
    await expect(page.getByRole('link', { name: 'Edit Pet' })).toHaveCount(1);
  });
});
