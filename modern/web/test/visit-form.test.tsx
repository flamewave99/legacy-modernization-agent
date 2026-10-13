// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { slashDate, todayIso, VisitForm, type VisitPet } from '../src/pages/VisitForm.js';

const MAX: VisitPet = {
  id: 8,
  name: 'Max',
  birthDate: '2012-09-04',
  type: 'cat',
  visits: [
    { id: 3, date: '2013-01-03', description: 'neutered' },
    { id: 2, date: '2013-01-02', description: 'rabies shot' },
  ],
  owner: { id: 6, firstName: 'Jean', lastName: 'Coleman' },
};

function render(errors = {}, initial = { date: '2024-05-06', description: '' }): Document {
  const html = renderToStaticMarkup(
    <VisitForm pet={MAX} initial={initial} errors={errors} onSubmit={() => undefined} />,
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ');

describe('VisitForm', () => {
  it('shows the pet row and previous visits with yyyy/MM/dd dates', () => {
    const [petTable, visitsTable] = render().querySelectorAll('table');
    expect(text(petTable)).toBe('NameBirth DateTypeOwnerMax2012/09/04catJean Coleman');
    expect(text(visitsTable)).toBe('DateDescription2013/01/03neutered2013/01/02rabies shot');
  });

  it('has the date and description fields, "New Visit" and "Add Visit"', () => {
    const doc = render();
    expect(doc.querySelector('h2')?.textContent).toBe('New Visit');
    const inputs = [...doc.querySelectorAll('input')];
    expect(inputs.map((i) => [i.getAttribute('name'), i.getAttribute('value')])).toEqual([
      ['date', '2024-05-06'],
      ['description', ''],
    ]);
    expect(doc.querySelector('button')?.textContent).toBe('Add Visit');
  });

  it('puts each error inside its field wrapper', () => {
    const doc = render({ date: 'invalid date', description: 'must not be empty' });
    const wrapper = (name: string) => doc.querySelector(`[name="${name}"]`)?.parentElement;
    expect(wrapper('date')?.textContent).toBe('invalid date');
    expect(wrapper('description')?.textContent).toBe('must not be empty');
  });
});

describe('date helpers', () => {
  it('slashDate swaps dashes and blanks a missing date', () => {
    expect(slashDate('2013-01-03')).toBe('2013/01/03');
    expect(slashDate(null)).toBe('');
  });

  it('todayIso pads month and day in local time', () => {
    expect(todayIso(new Date(2024, 0, 5, 23, 59))).toBe('2024-01-05');
  });
});
