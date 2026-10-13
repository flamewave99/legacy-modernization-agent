// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useApi } from '../src/api/preloaded.js';
import { useRedirect } from '../src/api/redirect.js';

let redirect: ReturnType<typeof useRedirect> | undefined;

function Form() {
  redirect = useRedirect();
  return <p>form</p>;
}

function Target() {
  const data = useApi<string>('/api/target');
  return <p>{data?.ok ? data.data : 'loading'}</p>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useRedirect', () => {
  it('commits the new route with its data already rendered', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify('loaded'))));
    const container = document.createElement('div');
    document.body.append(container);
    act(() => {
      createRoot(container).render(
        <MemoryRouter initialEntries={['/form']} useTransitions={false}>
          <Routes>
            <Route path="/form" element={<Form />} />
            <Route path="/target" element={<Target />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    expect(container.textContent).toBe('form');
    await redirect?.('/target', '/api/target');
    expect(container.textContent).toBe('loaded');
  });
});
