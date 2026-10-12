// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ErrorPage } from '../src/pages/ErrorPage.js';
import { Oups } from '../src/pages/Oups.js';

function render(node: ReactNode): Document {
  const html = renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('ErrorPage', () => {
  it('shows the image, heading and message with the Error item active', () => {
    const doc = render(<ErrorPage message="Owner 9 not found" />);
    const content = doc.querySelector('.xd-container');
    expect(content?.querySelector('img')?.getAttribute('alt')).toBe('A cat and a dog');
    expect(content?.querySelector('img')?.getAttribute('src')).toBe('/resources/images/pets.png');
    expect(content?.querySelector('h2')?.textContent).toBe('Something happened...');
    expect(content?.querySelector('p')?.textContent).toBe('Owner 9 not found');
    expect(doc.querySelector('a.nav-link.active')?.textContent.trim()).toBe('Error');
  });

  it('escapes the message', () => {
    const doc = render(<ErrorPage message="<b>x</b>" />);
    expect(doc.querySelector('.xd-container p')?.textContent).toBe('<b>x</b>');
  });
});

describe('Oups', () => {
  it('shows the CrashController message', () => {
    const doc = render(<Oups />);
    expect(doc.querySelector('.xd-container p')?.textContent).toBe(
      'Expected: controller used to showcase what happens when an exception is thrown',
    );
  });
});
