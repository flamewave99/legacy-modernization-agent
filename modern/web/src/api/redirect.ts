import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { getJson } from './client.js';
import { preload } from './preloaded.js';

/**
 * Navigates to the page `to` the way legacy's `redirect:` does: the new URL and the page's data
 * appear together. `apiPath` (the data `to` renders) is fetched first and preloaded, then the
 * route is committed synchronously, so nothing can observe the new URL with an empty page.
 * Needs `<BrowserRouter useTransitions={false}>`. A failed fetch still navigates; the page then
 * fetches the data itself.
 */
export function useRedirect(): (to: string, apiPath: string) => Promise<void> {
  const navigate = useNavigate();
  return async (to, apiPath) => {
    try {
      preload(apiPath, await getJson(apiPath));
    } catch {
      // The page fetches again and handles it.
    }
    flushSync(() => {
      void navigate(to);
    });
  };
}
