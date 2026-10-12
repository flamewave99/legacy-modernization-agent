import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Selector contract (what an implementation must keep for this suite to apply):
 * - URLs and routes are identical to legacy.
 * - Form fields are found by their HTTP `name` attribute (firstName, birthDate, type, ...).
 * - Buttons, links and headings are found by their visible text / accessible role.
 * - A field's error message renders inside the innermost element that wraps that field.
 * - Owner details and lists are HTML tables (th labels, tr rows).
 * Nothing here depends on legacy CSS classes, JSP structure or element ids.
 */

/** Fixed-length unique token: no token is a prefix of another, which matters because
 *  owner search is a prefix match. Letters only so it is valid in any name field. */
export function uid(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function field(page: Page, name: string): Locator {
  return page.locator(`[name="${name}"]`);
}

/** Innermost element wrapping the field: where its validation message appears. */
export function fieldContainer(page: Page, name: string): Locator {
  return page.locator('div', { has: field(page, name) }).last();
}

/** Legacy attaches a flatpickr widget that makes date inputs read-only; a plain input is
 *  just filled. Either way the submitted value is exactly `value`. */
export async function fillDate(input: Locator, value: string): Promise<void> {
  if (await input.isEditable()) {
    await input.fill(value);
    return;
  }
  await input.evaluate((el, v) => {
    const node = el as HTMLInputElement;
    node.value = v;
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

/** The value cell of a `th`-labelled row, e.g. infoRow(page, 'City'). */
export function infoRow(page: Page, label: string): Locator {
  return page.locator('tr', { has: page.locator('th', { hasText: new RegExp(`^${label}$`) }) }).first();
}

export interface OwnerInput {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
}

export function newOwnerData(overrides: Partial<OwnerInput> = {}): OwnerInput {
  return {
    firstName: 'Testy',
    lastName: `T${uid()}`,
    address: '1 Test Lane',
    city: 'Testville',
    telephone: '6085550000',
    ...overrides,
  };
}

export async function fillOwnerForm(page: Page, owner: Partial<OwnerInput>): Promise<void> {
  for (const [name, value] of Object.entries(owner)) {
    await field(page, name).fill(value);
  }
}

/** Creates an owner through the UI and returns its id. */
export async function createOwner(page: Page, overrides: Partial<OwnerInput> = {}): Promise<{ id: number; owner: OwnerInput }> {
  const owner = newOwnerData(overrides);
  await page.goto('/owners/new');
  await fillOwnerForm(page, owner);
  await page.getByRole('button', { name: 'Add Owner' }).click();
  await expect(page).toHaveURL(/\/owners\/\d+$/);
  const id = Number(new URL(page.url()).pathname.split('/').pop());
  return { id, owner };
}

export interface PetInput {
  name: string;
  birthDate: string;
  type: string;
}

/** Adds a pet to an owner through the UI; ends on the owner page. */
export async function addPet(page: Page, ownerId: number, pet: PetInput): Promise<void> {
  await page.goto(`/owners/${ownerId}/pets/new`);
  await field(page, 'name').fill(pet.name);
  await fillDate(field(page, 'birthDate'), pet.birthDate);
  await field(page, 'type').selectOption(pet.type);
  await page.getByRole('button', { name: 'Add Pet' }).click();
  await expect(page).toHaveURL(new RegExp(`/owners/${ownerId}$`));
}

/** Pet ids come from the "Edit Pet" links on the owner page, in display order. */
export async function petIds(page: Page, ownerId: number): Promise<number[]> {
  await page.goto(`/owners/${ownerId}`);
  const hrefs = await page.getByRole('link', { name: 'Edit Pet' }).evaluateAll((links) =>
    links.map((a) => a.getAttribute('href') ?? ''),
  );
  return hrefs.map((h) => Number(/pets\/(\d+)\/edit/.exec(h)?.[1]));
}

/** Text of the main page area with whitespace collapsed, for order-sensitive checks. */
export async function pageText(page: Page): Promise<string> {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ');
}

/** The URL a link navigates to (legacy mixes relative and absolute hrefs). */
export async function linkTarget(link: Locator): Promise<string> {
  return new URL(await link.evaluate((a) => (a as HTMLAnchorElement).href)).pathname;
}

/** yyyy-MM-dd strings for yesterday/today/tomorrow: the server's clock and timezone are
 *  not visible to the test, so "today" is accepted within one day either way. */
export function aroundToday(): string[] {
  const out: string[] = [];
  for (const offset of [-1, 0, 1]) {
    const d = new Date(Date.now() + offset * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return out;
}
