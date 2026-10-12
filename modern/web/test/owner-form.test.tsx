// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EMPTY_OWNER, OwnerForm, type FieldErrors } from '../src/pages/OwnerForm.js';

function render(isNew: boolean, errors: FieldErrors = {}, initial = EMPTY_OWNER): Document {
  const html = renderToStaticMarkup(
    <OwnerForm isNew={isNew} initial={initial} errors={errors} onSubmit={() => undefined} />,
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

const george = {
  firstName: 'George',
  lastName: 'Franklin',
  address: '110 W. Liberty St.',
  city: 'Madison',
  telephone: '6085551023',
};

describe('OwnerForm', () => {
  it('new: empty fields in legacy order, "New Owner" and "Add Owner"', () => {
    const doc = render(true);
    expect(doc.querySelector('h2')?.textContent).toBe('New Owner');
    const inputs = [...doc.querySelectorAll('input')];
    expect(inputs.map((i) => i.getAttribute('name'))).toEqual([
      'firstName',
      'lastName',
      'address',
      'city',
      'telephone',
    ]);
    expect(inputs.map((i) => i.getAttribute('value'))).toEqual(['', '', '', '', '']);
    expect([...doc.querySelectorAll('label')].map((l) => l.textContent)).toEqual([
      'First Name',
      'Last Name',
      'Address',
      'City',
      'Telephone',
    ]);
    expect(doc.querySelector('button')?.textContent).toBe('Add Owner');
  });

  it('edit: pre-filled, "Owner" and "Update Owner", also with errors (D2 fix)', () => {
    const doc = render(false, { lastName: 'must not be empty' }, george);
    expect(doc.querySelector('h2')?.textContent).toBe('Owner');
    expect(doc.querySelector('input[name="city"]')?.getAttribute('value')).toBe('Madison');
    expect(doc.querySelector('button')?.textContent).toBe('Update Owner');
  });

  it('puts each error inside its input wrapper only', () => {
    const doc = render(true, {
      city: 'must not be empty',
      telephone: 'numeric value out of bounds (<10 digits>.<0 digits> expected)',
    });
    const wrapper = (name: string) => doc.querySelector(`input[name="${name}"]`)?.parentElement;
    expect(wrapper('city')?.textContent).toBe('must not be empty');
    expect(wrapper('telephone')?.textContent).toBe(
      'numeric value out of bounds (<10 digits>.<0 digits> expected)',
    );
    expect(wrapper('firstName')?.textContent).toBe('');
    expect(wrapper('city')?.parentElement?.className).toBe('form-group has-error');
  });
});
