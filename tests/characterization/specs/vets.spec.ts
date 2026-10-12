import { expect, test } from '@playwright/test';

const VETS: Array<[string, string]> = [
  ['James Carter', 'none'],
  ['Linda Douglas', 'dentistry surgery'],
  ['Sharon Jenkins', 'none'],
  ['Helen Leary', 'radiology'],
  ['Rafael Ortega', 'surgery'],
  ['Henry Stevens', 'radiology'],
];

test('vets page lists vets by last name with specialties, "none" when empty', async ({ page }) => {
  await page.goto('/vets');
  await expect(page.getByRole('heading', { name: 'Veterinarians' })).toBeVisible();
  await expect(page.locator('thead th')).toHaveText(['Name', 'Specialties']);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(VETS.length);
  for (const [i, [name, specialties]] of VETS.entries()) {
    await expect(rows.nth(i).locator('td')).toHaveText([name, specialties]);
  }
});

test('vets page links to XML and JSON views', async ({ page }) => {
  await page.goto('/vets');
  await expect(page.getByRole('link', { name: 'View as XML' })).toHaveAttribute('href', '/vets.xml');
  await expect(page.getByRole('link', { name: 'View as JSON' })).toHaveAttribute('href', '/vets.json');
});

test('GET /vets.json returns the vet list as JSON', async ({ request }) => {
  const response = await request.get('/vets.json');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^application\/json/);
  expect(await response.json()).toEqual({
    vetList: [
      { firstName: 'James', id: 1, lastName: 'Carter', new: false, nrOfSpecialties: 0, specialties: [] },
      {
        firstName: 'Linda', id: 3, lastName: 'Douglas', new: false, nrOfSpecialties: 2,
        specialties: [{ id: 3, name: 'dentistry', new: false }, { id: 2, name: 'surgery', new: false }],
      },
      { firstName: 'Sharon', id: 6, lastName: 'Jenkins', new: false, nrOfSpecialties: 0, specialties: [] },
      {
        firstName: 'Helen', id: 2, lastName: 'Leary', new: false, nrOfSpecialties: 1,
        specialties: [{ id: 1, name: 'radiology', new: false }],
      },
      {
        firstName: 'Rafael', id: 4, lastName: 'Ortega', new: false, nrOfSpecialties: 1,
        specialties: [{ id: 2, name: 'surgery', new: false }],
      },
      {
        firstName: 'Henry', id: 5, lastName: 'Stevens', new: false, nrOfSpecialties: 1,
        specialties: [{ id: 1, name: 'radiology', new: false }],
      },
    ],
  });
});

test('GET /vets.xml returns the vet list as XML', async ({ request }) => {
  const response = await request.get('/vets.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^application\/xml/);
  expect(await response.text()).toBe(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><vets>' +
      '<vet><id>1</id><firstName>James</firstName><lastName>Carter</lastName></vet>' +
      '<vet><id>3</id><firstName>Linda</firstName><lastName>Douglas</lastName>' +
      '<specialties><id>3</id><name>dentistry</name></specialties>' +
      '<specialties><id>2</id><name>surgery</name></specialties></vet>' +
      '<vet><id>6</id><firstName>Sharon</firstName><lastName>Jenkins</lastName></vet>' +
      '<vet><id>2</id><firstName>Helen</firstName><lastName>Leary</lastName>' +
      '<specialties><id>1</id><name>radiology</name></specialties></vet>' +
      '<vet><id>4</id><firstName>Rafael</firstName><lastName>Ortega</lastName>' +
      '<specialties><id>2</id><name>surgery</name></specialties></vet>' +
      '<vet><id>5</id><firstName>Henry</firstName><lastName>Stevens</lastName>' +
      '<specialties><id>1</id><name>radiology</name></specialties></vet>' +
      '</vets>',
  );
});
