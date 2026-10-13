import { useEffect, type SubmitEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useApi } from '../api/preloaded.js';
import { Layout } from '../layout/Layout.js';

export interface OwnerSummary {
  id: number;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
  pets: { id: number; name: string }[];
}

/** The URL legacy's GET form submits to: `/owners?lastName=<form-encoded term>`. */
export function searchUrl(lastName: string): string {
  return `/owners?${new URLSearchParams({ lastName }).toString()}`;
}

interface FindOwnersFormProps {
  lastName: string;
  error?: string | undefined;
}

// findOwners.jsp [SPEC §4.1]. The error renders inside the input's wrapper, as `form:errors` does.
export function FindOwnersForm({ lastName, error }: FindOwnersFormProps) {
  const navigate = useNavigate();

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get('lastName');
    void navigate(searchUrl(typeof value === 'string' ? value : ''));
  }

  return (
    <>
      <h2>Find Owners</h2>

      <form
        id="search-owner-form"
        className="form-horizontal"
        action="/owners"
        method="get"
        onSubmit={onSubmit}
      >
        <div className="form-group">
          <div className="control-group" id="lastName">
            <label className="col-sm-2 control-label">Last name </label>
            <div className="col-sm-10">
              <input
                key={lastName}
                className="form-control"
                type="text"
                name="lastName"
                defaultValue={lastName}
                size={30}
                maxLength={80}
              />
              <span className="help-inline">
                {error !== undefined && <span id="owner.errors">{error}</span>}
              </span>
            </div>
          </div>
        </div>
        <div className="form-group">
          <div className="col-sm-offset-2 col-sm-10">
            <button type="submit" className="btn btn-primary">
              Find Owner
            </button>
          </div>
        </div>
      </form>

      <br />
      <Link className="btn btn-primary" to="/owners/new">
        Add Owner
      </Link>
    </>
  );
}

// ownersList.jsp [SPEC §4.2]. The API returns owners in id order and pets sorted by name; like the
// JSP's `<c:out value="${pet.name} "/>`, every pet name is followed by a space.
export function OwnersTable({ owners }: { owners: readonly OwnerSummary[] }) {
  return (
    <>
      <h2 id="owners">Owners</h2>

      <table id="ownersTable" className="table table-striped" aria-describedby="owners">
        <thead>
          <tr>
            <th scope="col" style={{ width: '150px' }}>
              Name
            </th>
            <th scope="col" style={{ width: '200px' }}>
              Address
            </th>
            <th scope="col">City</th>
            <th scope="col" style={{ width: '120px' }}>
              Telephone
            </th>
            <th scope="col">Pets</th>
          </tr>
        </thead>
        <tbody>
          {owners.map((owner) => (
            <tr key={owner.id}>
              <td>
                <Link to={`/owners/${String(owner.id)}`}>
                  {`${owner.firstName} ${owner.lastName}`}
                </Link>
              </td>
              <td>{owner.address}</td>
              <td>{owner.city}</td>
              <td>{owner.telephone}</td>
              <td>{owner.pets.map((p) => `${p.name} `).join('')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** `/owners/find`: legacy binds a fresh Owner, so any `?lastName=` here is ignored. */
export function FindOwners() {
  return (
    <Layout menu="owners">
      <FindOwnersForm lastName="" />
    </Layout>
  );
}

/** The API search for a `lastName` term; Fastify builds the same path to preload it. */
export function ownersSearchApi(lastName: string): string {
  return `/api${searchUrl(lastName)}`;
}

/**
 * `/owners?lastName=` [SPEC §5.1]: no match re-shows the form with the term and an error, two or
 * more show the list. One match is a redirect to the owner: Fastify answers a page load with a
 * 302, and after an in-app search the history entry is replaced. A missing `lastName` searches
 * for everything.
 */
export function OwnersSearch() {
  const [params] = useSearchParams();
  // Spring binds a repeated parameter by joining the values with commas, as the API does.
  const lastName = params.getAll('lastName').join(',');
  const owners = useApi<OwnerSummary[]>(ownersSearchApi(lastName));
  const navigate = useNavigate();
  const only = owners?.ok && owners.data.length === 1 ? owners.data[0] : undefined;

  useEffect(() => {
    if (only) void navigate(`/owners/${String(only.id)}`, { replace: true });
  }, [only, navigate]);

  return (
    <Layout menu="owners">
      {owners?.ok &&
        !only &&
        (owners.data.length === 0 ? (
          <FindOwnersForm lastName={lastName} error="has not been found" />
        ) : (
          <OwnersTable owners={owners.data} />
        ))}
    </Layout>
  );
}
