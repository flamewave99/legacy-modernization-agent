import { useApi } from '../api/preloaded.js';
import { Layout } from '../layout/Layout.js';

export interface Vet {
  id: number;
  firstName: string;
  lastName: string;
  specialties: { id: number; name: string }[];
}

// vetList.jsp [SPEC §4.7]. The API already sorts vets by last then first name and each vet's
// specialties by name. Like the JSP's `<c:out value="${specialty.name} "/>`, every specialty is
// followed by a space.
export function VetsTable({ vets }: { vets: readonly Vet[] }) {
  return (
    <>
      <h2 id="veterinarians">Veterinarians</h2>

      <div className="row">
        <table id="vetsTable" className="table table-striped" aria-describedby="veterinarians">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Specialties</th>
            </tr>
          </thead>
          <tbody>
            {vets.map((vet) => (
              <tr key={vet.id}>
                <td>{`${vet.firstName} ${vet.lastName}`}</td>
                <td>
                  {vet.specialties.length === 0
                    ? 'none'
                    : vet.specialties.map((s) => `${s.name} `).join('')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row">
        <div className="col-md-2">
          <a href="/vets.xml">View as XML</a>
        </div>
        <div className="col-md-2">
          <a href="/vets.json">View as JSON</a>
        </div>
      </div>
    </>
  );
}

export function Vets() {
  const vets = useApi<Vet[]>('/api/vets');
  return <Layout menu="vets">{vets?.ok && <VetsTable vets={vets.data} />}</Layout>;
}
