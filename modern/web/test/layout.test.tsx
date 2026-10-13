// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Layout, type MenuName } from '../src/layout/Layout.js';
import { Welcome } from '../src/pages/Welcome.js';

function render(node: ReactNode): Document {
  const html = renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('Layout', () => {
  it('renders the navbar links in legacy order', () => {
    const doc = render(<Layout menu="home">x</Layout>);
    const links = [...doc.querySelectorAll('nav[role=navigation] .navbar-nav a')].map((a) => [
      a.textContent.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Home', '/'],
      ['Find owners', '/owners/find'],
      ['Veterinarians', '/vets'],
      ['Error', '/oups'],
    ]);
    expect(doc.querySelector('a.navbar-brand')?.getAttribute('href')).toBe('/');
  });

  it.each<[MenuName, string]>([
    ['home', 'Home'],
    ['owners', 'Find owners'],
    ['vets', 'Veterinarians'],
    ['error', 'Error'],
  ])('marks %s as the only active item', (menu, text) => {
    const doc = render(<Layout menu={menu}>x</Layout>);
    const active = [...doc.querySelectorAll('a.nav-link.active')].map((a) => a.textContent.trim());
    expect(active).toEqual([text]);
    expect(doc.querySelectorAll('li.nav-item')).toHaveLength(1);
  });

  it('shows the Pivotal sponsor image after the content', () => {
    const doc = render(<Layout menu="home">content</Layout>);
    const img = doc.querySelector('.xd-container img[alt="Sponsored by Pivotal"]');
    expect(img?.getAttribute('src')).toBe('/resources/images/spring-pivotal-logo.png');
  });
});

describe('Welcome', () => {
  it('shows the heading and the pets image', () => {
    const doc = render(<Welcome />);
    expect(doc.querySelector('h2')?.textContent).toBe('Welcome');
    expect(doc.querySelector('img[alt="A cat and a dog"]')?.getAttribute('src')).toBe(
      '/resources/images/pets.png',
    );
  });
});
