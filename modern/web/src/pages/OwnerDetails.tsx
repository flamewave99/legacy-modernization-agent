import { Link, useParams } from 'react-router';
import { useApi } from '../api/preloaded.js';
import { Layout } from '../layout/Layout.js';
import { ErrorPage } from './ErrorPage.js';

export interface OwnerWithPets {
  id: number;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
  pets: {
    id: number;
    name: string;
    birthDate: string | null;
    type: string;
    visits: { id: number; date: string | null; description: string }[];
  }[];
}

// ownerDetails.jsp [SPEC §4.3]. The API already sorts pets by name and visits newest first, and
// sends dates as yyyy-MM-dd. The pet block is a `dl` inside a `th` so the page text reads
// `Name Max Birth Date ... Type cat Visit Date Description ...` in legacy's order.
export function OwnerInfo({ owner }: { owner: OwnerWithPets }) {
  const base = `/owners/${String(owner.id)}`;
  return (
    <>
      <h2 id="ownerInformation">Owner Information</h2>
      <table className="table table-striped" aria-describedby="ownerInformation">
        <tbody>
          <tr>
            <th id="name">Name</th>
            <td headers="name">
              <strong>{`${owner.firstName} ${owner.lastName}`}</strong>
            </td>
          </tr>
          <tr>
            <th id="address">Address</th>
            <td headers="address">{owner.address}</td>
          </tr>
          <tr>
            <th id="city">City</th>
            <td headers="city">{owner.city}</td>
          </tr>
          <tr>
            <th id="telephone">Telephone</th>
            <td headers="telephone">{owner.telephone}</td>
          </tr>
        </tbody>
      </table>
      <Link to={`${base}/edit`} className="btn btn-primary">
        Edit Owner
      </Link>{' '}
      <Link to={`${base}/pets/new`} className="btn btn-primary">
        Add New Pet
      </Link>
      <br />
      <br />
      <br />
      <h2 id="petsAndVisits">Pets and Visits</h2>
      <table className="table table-striped" aria-describedby="petsAndVisits">
        <tbody>
          {owner.pets.map((pet) => (
            <tr key={pet.id}>
              <th scope="col">
                <dl className="dl-horizontal">
                  <dt>Name</dt>
                  <dd>{pet.name}</dd>
                  <dt>Birth Date</dt>
                  <dd>{pet.birthDate ?? ''}</dd>
                  <dt>Type</dt>
                  <dd>{pet.type}</dd>
                </dl>
              </th>
              <td>
                <table className="table-condensed" aria-describedby="petsAndVisits">
                  <thead>
                    <tr>
                      <th id="visitDate">Visit Date</th>
                      <th id="visitDescription">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pet.visits.map((visit) => (
                      <tr key={visit.id}>
                        <td headers="visitDate">{visit.date ?? ''}</td>
                        <td headers="visitDescription">{visit.description}</td>
                      </tr>
                    ))}
                    <tr>
                      <td>
                        <Link to={`${base}/pets/${String(pet.id)}/edit`}>Edit Pet</Link>
                      </td>
                      <td>
                        <Link to={`${base}/pets/${String(pet.id)}/visits/new`}>Add Visit</Link>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// An unknown owner makes legacy's `findById` throw, and the exception page is rendered with
// HTTP 200 (Fastify already served index.html).
export function OwnerDetails() {
  const { ownerId = '' } = useParams();
  const owner = useApi<OwnerWithPets>(`/api/owners/${encodeURIComponent(ownerId)}`);

  if (owner && !owner.ok) return <ErrorPage message={owner.error} />;
  return <Layout menu="owners">{owner?.ok && <OwnerInfo owner={owner.data} />}</Layout>;
}
