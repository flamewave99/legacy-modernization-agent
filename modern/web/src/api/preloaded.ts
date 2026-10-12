import { useEffect, useState } from 'react';
import { getJson, type Fetched } from './client.js';

interface Preloaded {
  path: string;
  result: Fetched<unknown>;
}

let preloaded: Preloaded | undefined | null = null;

/**
 * The API response Fastify embedded in index.html for the page that was loaded, if it is for
 * `path`. It is handed out once: any later visit to the page fetches fresh data.
 */
export function takePreloaded(path: string): Fetched<unknown> | undefined {
  if (preloaded === null) {
    const text = document.getElementById('preloaded')?.textContent;
    preloaded = text ? (JSON.parse(text) as Preloaded) : undefined;
  }
  if (preloaded?.path !== path) return undefined;
  const { result } = preloaded;
  preloaded = undefined;
  return result;
}

/**
 * GETs `path`, starting from the preloaded response when there is one, so a page loaded directly
 * renders its data before the browser's `load` event, as a server-rendered JSP does.
 * `undefined` while the request is in flight; a network failure leaves it so.
 */
export function useApi<T>(path: string): Fetched<T> | undefined {
  const [state, setState] = useState<{ path: string; result: Fetched<T> } | undefined>(() => {
    const result = takePreloaded(path);
    return result && { path, result: result as Fetched<T> };
  });
  const current = state?.path === path ? state.result : undefined;
  const loaded = current !== undefined;

  useEffect(() => {
    if (loaded) return;
    const ctrl = new AbortController();
    getJson<T>(path, ctrl.signal).then(
      (result) => {
        setState({ path, result });
      },
      () => {
        // Aborted on unmount, or a network failure; nothing to render.
      },
    );
    return () => {
      ctrl.abort();
    };
  }, [path, loaded]);

  return current;
}
