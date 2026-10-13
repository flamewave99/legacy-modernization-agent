import 'font-awesome/css/font-awesome.min.css';
// Legacy's footer.tag loads the Bootstrap bundle; the navbar toggler needs it on narrow screens.
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// Rendered synchronously, so a page with preloaded data is complete before `load` fires. No
// transitions, so `useRedirect` can commit a route change synchronously.
flushSync(() => {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter useTransitions={false}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
});
