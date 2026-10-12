import { useState, type SubmitEvent } from 'react';
import { useParams } from 'react-router';
import { sendJson } from '../api/client.js';
import { useApi } from '../api/preloaded.js';
import { useRedirect } from '../api/redirect.js';
import { Layout } from '../layout/Layout.js';
import { ErrorPage } from './ErrorPage.js';
import { Field } from './PetForm.js';

export interface VisitFields {
  /** As typed: the API accepts `yyyy-MM-dd` and `yyyy/MM/dd`. */
  date: string;
  description: string;
}

export type VisitFieldErrors = Partial<Record<keyof VisitFields, string>>;

export interface VisitPet {
  id: number;
  name: string;
  birthDate: string | null;
  type: string;
  /** Newest first, dates as `yyyy-MM-dd`. */
  visits: { id: number; date: string | null; description: string }[];
  owner: { id: number; firstName: string; lastName: string };
}

/** `yyyy-MM-dd` from the API as `yyyy/MM/dd`, as `petclinic:localDate` renders it on this page. */
export function slashDate(iso: string | null): string {
  return iso === null ? '' : iso.replace(/-/g, '/');
}

/** Today in the browser's time zone as `yyyy-MM-dd`, what legacy's flatpickr shows for `now()`. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

interface VisitFormProps {
  pet: VisitPet;
  initial: VisitFields;
  errors?: VisitFieldErrors;
  onSubmit: (visit: VisitFields) => void;
}

// createOrUpdateVisitForm.jsp [SPEC §4.6]. Both tables show dates as yyyy/MM/dd; the date input
// shows yyyy-MM-dd like legacy's flatpickr. The API already sorts visits newest first.
export function VisitForm({ pet, initial, errors = {}, onSubmit }: VisitFormProps) {
  const [values, setValues] = useState(initial);

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <>
      <h2>New Visit</h2>
      <span id="pet">
        <strong>Pet</strong>
      </span>
      <table className="table table-striped" aria-describedby="pet">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Birth Date</th>
            <th scope="col">Type</th>
            <th scope="col">Owner</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{pet.name}</td>
            <td>{slashDate(pet.birthDate)}</td>
            <td>{pet.type}</td>
            <td>{`${pet.owner.firstName} ${pet.owner.lastName}`}</td>
          </tr>
        </tbody>
      </table>

      <form className="form-horizontal" method="post" onSubmit={submit}>
        <div className="form-group has-feedback">
          {(['date', 'description'] as const).map((name) => (
            <Field
              key={name}
              label={name === 'date' ? 'Date' : 'Description'}
              error={errors[name]}
              valid={values[name] !== ''}
              errorClass="has-error"
            >
              <input
                className="form-control"
                id={name}
                name={name}
                type="text"
                value={values[name]}
                onChange={(e) => {
                  setValues({ ...values, [name]: e.target.value });
                }}
              />
            </Field>
          ))}
        </div>
        <div className="form-group">
          <div className="col-sm-offset-2 col-sm-10">
            <button className="btn btn-primary" type="submit">
              Add Visit
            </button>
          </div>
        </div>
      </form>

      <br />
      <strong id="previousVisits">Previous Visits</strong>
      <table className="table table-striped" aria-describedby="previousVisits">
        <tbody>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
          </tr>
          {pet.visits.map((visit) => (
            <tr key={visit.id}>
              <td>{slashDate(visit.date)}</td>
              <td>{visit.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/**
 * `/owners/{ownerId}/pets/{petId}/visits/new`. Like legacy's `loadPetWithVisit`, the pet is found
 * by its id alone; an unknown one shows the error page. Saving redirects to `/owners/{ownerId}`
 * (the path's owner, D8); a pet deleted meanwhile shows the error page, as legacy's POST does.
 */
export function NewVisit() {
  const { ownerId = '', petId = '' } = useParams();
  const pet = useApi<VisitPet>(`/api/pets/${encodeURIComponent(petId)}`);
  const [errors, setErrors] = useState<VisitFieldErrors>({});
  const [gone, setGone] = useState<string>();
  const redirect = useRedirect();
  const ownerPath = `/owners/${encodeURIComponent(ownerId)}`;

  async function save(visit: VisitFields): Promise<void> {
    const res = await sendJson(
      'POST',
      `/api${ownerPath}/pets/${encodeURIComponent(petId)}/visits`,
      visit,
    );
    if (res.status === 422) {
      setErrors((res.body as { errors: VisitFieldErrors }).errors);
    } else if (res.status === 201) {
      await redirect(ownerPath, `/api${ownerPath}`);
    } else if (res.status === 404) {
      setGone((res.body as { error: string }).error);
    } else {
      throw new Error(`Saving visit failed with ${String(res.status)}`);
    }
  }

  if (gone !== undefined) return <ErrorPage message={gone} />;
  if (pet && !pet.ok) return <ErrorPage message={pet.error} />;
  return (
    <Layout menu="owners">
      {pet?.ok && (
        <VisitForm
          key={petId}
          pet={pet.data}
          initial={{ date: todayIso(), description: '' }}
          errors={errors}
          onSubmit={(visit) => {
            void save(visit);
          }}
        />
      )}
    </Layout>
  );
}
