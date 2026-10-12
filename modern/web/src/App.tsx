import { Route, Routes } from 'react-router';
import { FindOwners, OwnersSearch } from './pages/FindOwners.js';
import { Oups } from './pages/Oups.js';
import { OwnerDetails } from './pages/OwnerDetails.js';
import { EditOwner, NewOwner } from './pages/OwnerForm.js';
import { Vets } from './pages/Vets.js';
import { Welcome } from './pages/Welcome.js';

// Page routes [SPEC §3]. Fastify only serves index.html for these patterns, so there is no
// client-side catch-all: unknown paths and non-numeric ids never reach the SPA.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/owners" element={<OwnersSearch />} />
      <Route path="/owners/find" element={<FindOwners />} />
      <Route path="/owners/new" element={<NewOwner />} />
      <Route path="/owners/:ownerId" element={<OwnerDetails />} />
      <Route path="/owners/:ownerId/edit" element={<EditOwner />} />
      <Route path="/vets" element={<Vets />} />
      <Route path="/oups" element={<Oups />} />
    </Routes>
  );
}
