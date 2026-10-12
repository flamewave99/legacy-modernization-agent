// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { VetsTable, type Vet } from '../src/pages/Vets.js';

function render(vets: Vet[]): Document {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <VetsTable vets={vets} />
    </MemoryRouter>,
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('VetsTable', () => {
  it('renders names, space-separated specialties and "none"', () => {
    const doc = render([
      { id: 1, firstName: 'James', lastName: 'Carter', specialties: [] },
      {
        id: 3,
        firstName: 'Linda',
        lastName: 'Douglas',
        specialties: [
          { id: 3, name: 'dentistry' },
          { id: 2, name: 'surgery' },
        ],
      },
    ]);
    expect(doc.querySelector('h2')?.textContent).toBe('Veterinarians');
    expect([...doc.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual([
      'Name',
      'Specialties',
    ]);
    const cells = [...doc.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent),
    );
    expect(cells).toEqual([
      ['James Carter', 'none'],
      ['Linda Douglas', 'dentistry surgery '],
    ]);
  });

  it('escapes names and links to the XML and JSON views', () => {
    const doc = render([{ id: 1, firstName: '<b>', lastName: 'x', specialties: [] }]);
    expect(doc.querySelector('tbody td')?.textContent).toBe('<b> x');
    const links = [...doc.querySelectorAll('a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['View as XML', '/vets.xml'],
      ['View as JSON', '/vets.json'],
    ]);
  });
});
