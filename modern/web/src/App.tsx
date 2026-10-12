import { Route, Routes } from 'react-router';

// Page routes [SPEC §3]. Fastify only serves index.html for these patterns, so there is no
// client-side catch-all: unknown paths and non-numeric ids never reach the SPA.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<h2>Welcome</h2>} />
    </Routes>
  );
}
