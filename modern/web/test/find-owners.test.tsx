// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { FindOwnersForm, OwnersTable, searchUrl } from '../src/pages/FindOwners.js';

function render(node: ReactNode): Document {
  const html = renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('searchUrl', () => {
  it('form-encodes the term like a GET form', () => {
    expect(searchUrl('')).toBe('/owners?lastName=');
    expect(searchUrl('Davis')).toBe('/owners?lastName=Davis');
    expect(searchUrl('a b&%')).toBe('/owners?lastName=a+b%26%25');
  });
});

describe('FindOwnersForm', () => {
  it('keeps the term and puts the error inside the input wrapper', () => {
    const doc = render(<FindOwnersForm lastName="Zzz" error="has not been found" />);
    expect(doc.querySelector('h2')?.textContent).toBe('Find Owners');
    const input = doc.querySelector<HTMLInputElement>('input[name="lastName"]');
    expect(input?.getAttribute('value')).toBe('Zzz');
    expect(input?.getAttribute('maxlength')).toBe('80');
    expect(input?.parentElement?.textContent).toBe('has not been found');
    expect(doc.querySelector('button')?.textContent).toBe('Find Owner');
    expect(doc.querySelector('a.btn')?.getAttribute('href')).toBe('/owners/new');
  });

  it('shows no error by default', () => {
    const doc = render(<FindOwnersForm lastName="" />);
    expect(doc.querySelector('.help-inline')?.textContent).toBe('');
  });
});

describe('OwnersTable', () => {
  it('renders one escaped row per owner with space-separated pets', () => {
    const doc = render(
      <OwnersTable
        owners={[
          {
            id: 3,
            firstName: 'Eduardo',
            lastName: '<b>',
            address: '2693 Commerce St.',
            city: 'McFarland',
            telephone: '6085558763',
            pets: [
              { id: 4, name: 'Jewel' },
              { id: 3, name: 'Rosy' },
            ],
          },
        ]}
      />,
    );
    expect([...doc.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual([
      'Name',
      'Address',
      'City',
      'Telephone',
      'Pets',
    ]);
    const cells = [...doc.querySelectorAll('tbody td')].map((td) => td.textContent);
    expect(cells).toEqual([
      'Eduardo <b>',
      '2693 Commerce St.',
      'McFarland',
      '6085558763',
      'Jewel Rosy ',
    ]);
    expect(doc.querySelector('tbody a')?.getAttribute('href')).toBe('/owners/3');
  });
});
