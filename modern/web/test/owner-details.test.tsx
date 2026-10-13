// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { OwnerInfo, type OwnerWithPets } from '../src/pages/OwnerDetails.js';

function render(owner: OwnerWithPets): Document {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <OwnerInfo owner={owner} />
    </MemoryRouter>,
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

const jean: OwnerWithPets = {
  id: 6,
  firstName: 'Jean',
  lastName: 'Coleman',
  address: '105 N. Lake St.',
  city: 'Monona',
  telephone: '6085552654',
  pets: [
    {
      id: 8,
      name: 'Max',
      birthDate: '2012-09-04',
      type: 'cat',
      visits: [
        { id: 3, date: '2013-01-03', description: 'neutered' },
        { id: 2, date: '2013-01-02', description: 'rabies shot' },
      ],
    },
  ],
};

describe('OwnerInfo', () => {
  it('renders th-labelled owner rows with the name in bold', () => {
    const doc = render(jean);
    const rows = [...doc.querySelectorAll('#ownerInformation + table tr')].map((tr) => [
      tr.querySelector('th')?.textContent,
      tr.querySelector('td')?.textContent,
    ]);
    expect(rows).toEqual([
      ['Name', 'Jean Coleman'],
      ['Address', '105 N. Lake St.'],
      ['City', 'Monona'],
      ['Telephone', '6085552654'],
    ]);
    expect(doc.querySelector('td strong')?.textContent).toBe('Jean Coleman');
  });

  it('keeps legacy reading order for pets and visits', () => {
    const text = render(jean).body.textContent.replace(/\s+/g, ' ');
    // textContent has no separators between cells, so compare the token sequence.
    expect(text).toContain('NameMaxBirth Date2012-09-04TypecatVisit DateDescription');
    expect(text).toContain('2013-01-03neutered2013-01-02rabies shot');
  });

  it('links to edit owner, add pet, edit pet and add visit', () => {
    const links = [...render(jean).querySelectorAll('a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Edit Owner', '/owners/6/edit'],
      ['Add New Pet', '/owners/6/pets/new'],
      ['Edit Pet', '/owners/6/pets/8/edit'],
      ['Add Visit', '/owners/6/pets/8/visits/new'],
    ]);
  });

  it('escapes user data', () => {
    const doc = render({ ...jean, firstName: '<b>Bold</b>', address: '<script>x</script>' });
    expect(doc.querySelector('strong')?.textContent).toBe('<b>Bold</b> Coleman');
    expect(doc.querySelector('script')).toBeNull();
  });
});
