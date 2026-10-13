// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EMPTY_PET, PetForm, petBody, type PetFieldErrors } from '../src/pages/PetForm.js';

const TYPES = ['bird', 'cat', 'dog', 'hamster', 'lizard', 'snake'];
const leo = { name: 'Leo', birthDate: '2010-09-07', type: 'cat' };

function render(isNew: boolean, errors: PetFieldErrors = {}, initial = EMPTY_PET): Document {
  const html = renderToStaticMarkup(
    <PetForm
      isNew={isNew}
      ownerName="George Franklin"
      types={TYPES}
      initial={initial}
      errors={errors}
      onSubmit={() => undefined}
    />,
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

/** Mounts the form in the live DOM, so layout effects run. */
function mount(isNew: boolean, initial: typeof EMPTY_PET): HTMLSelectElement {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <PetForm
        isNew={isNew}
        ownerName="George Franklin"
        types={TYPES}
        initial={initial}
        onSubmit={() => undefined}
      />,
    );
  });
  const select = container.querySelector<HTMLSelectElement>('select[name="type"]');
  if (!select) throw new Error('no type select');
  return select;
}

describe('PetForm', () => {
  it('new: owner row, empty fields, types in order, "New Pet" and "Add Pet"', () => {
    const doc = render(true);
    expect(doc.querySelector('h2')?.textContent).toBe('New Pet');
    expect(doc.querySelector('form')?.textContent).toContain('OwnerGeorge Franklin');
    const inputs = [...doc.querySelectorAll('input')];
    expect(inputs.map((i) => i.getAttribute('name'))).toEqual(['name', 'birthDate']);
    expect(inputs.map((i) => i.getAttribute('value'))).toEqual(['', '']);
    expect(
      [...doc.querySelectorAll('select[name="type"] option')].map((o) => o.textContent),
    ).toEqual(TYPES);
    expect(doc.querySelector('button')?.textContent).toBe('Add Pet');
  });

  it('edit: pre-filled, "Pet" and "Update Pet"', () => {
    const doc = render(false, {}, leo);
    expect(doc.querySelector('h2')?.textContent).toBe('Pet');
    expect(doc.querySelector('input[name="birthDate"]')?.getAttribute('value')).toBe('2010-09-07');
    expect(doc.querySelector('button')?.textContent).toBe('Update Pet');
  });

  it('puts each error inside its field wrapper', () => {
    const doc = render(true, {
      name: 'is required',
      birthDate: 'invalid date',
      type: 'is required',
    });
    const wrapper = (name: string) => doc.querySelector(`[name="${name}"]`)?.parentElement;
    expect(wrapper('name')?.textContent).toBe('is required');
    expect(wrapper('birthDate')?.textContent).toBe('invalid date');
    expect(wrapper('type')?.textContent).toContain('is required');
  });

  it('selects nothing on new, and the pet type on edit', () => {
    expect(mount(true, EMPTY_PET).selectedIndex).toBe(-1);
    expect(mount(false, leo).value).toBe('cat');
  });
});

describe('petBody', () => {
  it('leaves out an unselected type', () => {
    expect(petBody({ name: 'a', birthDate: '', type: '' })).toEqual({ name: 'a', birthDate: '' });
    expect(petBody(leo)).toEqual(leo);
  });
});
