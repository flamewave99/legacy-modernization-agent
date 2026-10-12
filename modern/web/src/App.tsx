import { Route, Routes } from 'react-router';
import { Welcome } from './pages/Welcome.js';

// Page routes [SPEC §3]. Fastify only serves index.html for these patterns, so there is no
// client-side catch-all: unknown paths and non-numeric ids never reach the SPA.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
    </Routes>
  );
}
