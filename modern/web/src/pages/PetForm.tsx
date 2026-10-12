import { useLayoutEffect, useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import { useParams } from 'react-router';
import { sendJson } from '../api/client.js';
import { useApi } from '../api/preloaded.js';
import { useRedirect } from '../api/redirect.js';
import { Layout } from '../layout/Layout.js';
import { ErrorPage } from './ErrorPage.js';
import type { OwnerWithPets } from './OwnerDetails.js';

export interface PetFields {
  name: string;
  /** As typed: the API accepts `yyyy-MM-dd` and `yyyy/MM/dd`. */
  birthDate: string;
  /** Pet type name; `''` while nothing is selected. */
  type: string;
}

export type PetFieldErrors = Partial<Record<keyof PetFields, string>>;

export const EMPTY_PET: PetFields = { name: '', birthDate: '', type: '' };

interface PetWithOwner {
  id: number;
  name: string;
  birthDate: string | null;
  type: string;
  owner: { id: number; firstName: string; lastName: string };
}

interface PetType {
  id: number;
  name: string;
}

interface PetFormProps {
  isNew: boolean;
  /** `First Last`, shown as text in the "Owner" row. */
  ownerName: string;
  /** Type names in the API's order (by name). */
  types: readonly string[];
  initial: PetFields;
  errors?: PetFieldErrors;
  onSubmit: (pet: PetFields) => void;
}

/** inputField.tag / selectField.tag: label, then the control and its feedback in `col-sm-10`,
 *  so an error is inside the innermost element wrapping the field. */
function Field({
  label,
  error,
  valid,
  errorClass,
  children,
}: {
  label: string;
  error: string | undefined;
  valid: boolean;
  errorClass: string;
  children: ReactNode;
}) {
  return (
    <div className={`form-group ${error === undefined ? '' : errorClass}`}>
      <label className="col-sm-2 control-label">{label}</label>
      <div className="col-sm-10">
        {children}
        {valid && error === undefined && (
          <span className="fa fa-ok form-control-feedback" aria-hidden="true"></span>
        )}
        {error !== undefined && (
          <>
            <span className="fa fa-remove form-control-feedback" aria-hidden="true"></span>
            <span className="help-inline">{error}</span>
          </>
        )}
      </div>
    </div>
  );
}

// createOrUpdatePetForm.jsp [SPEC §4.5]. The birth date is a plain text input showing the API's
// `yyyy-MM-dd`, which is what legacy's flatpickr widget displays.
export function PetForm({ isNew, ownerName, types, initial, errors = {}, onSubmit }: PetFormProps) {
  const [values, setValues] = useState(initial);
  const select = useRef<HTMLSelectElement>(null);

  // The type select is uncontrolled: React selects the first option of a single select whose
  // value matches none, but legacy's listbox (size 5) starts with nothing selected on new.
  useLayoutEffect(() => {
    if (select.current) select.current.value = initial.type;
  }, [initial.type]);

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <>
      <h2>{isNew ? 'New Pet' : 'Pet'}</h2>
      <form className="form-horizontal" method="post" onSubmit={submit}>
        <div className="form-group has-feedback">
          <div className="form-group">
            <label className="col-sm-2 control-label">Owner</label>
            <div className="col-sm-10">{ownerName}</div>
          </div>
          {(['name', 'birthDate'] as const).map((name) => (
            <Field
              key={name}
              label={name === 'name' ? 'Name' : 'Birth Date'}
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
          <div className="control-group">
            <Field label="Type " error={errors.type} valid={values.type !== ''} errorClass="error">
              <select
                ref={select}
                className="form-control"
                id="type"
                name="type"
                size={5}
                onChange={(e) => {
                  setValues({ ...values, type: e.target.value });
                }}
              >
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <div className="form-group">
          <div className="col-sm-offset-2 col-sm-10">
            <button className="btn btn-primary" type="submit">
              {isNew ? 'Add Pet' : 'Update Pet'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/** The request body: an unselected type is left out, so the API answers `is required`. */
export function petBody(pet: PetFields): Partial<PetFields> {
  const { type, ...rest } = pet;
  return type === '' ? rest : pet;
}

/**
 * Form plus the errors of the last rejected submit. Saving navigates to the owner's page, as
 * legacy's `redirect:/owners/{ownerId}` does; a 404 (owner or pet gone meanwhile) goes there too.
 */
function PetFormWithErrors({
  ownerId,
  petId,
  ownerName,
  types,
  initial,
}: {
  ownerId: string;
  petId: string | undefined;
  ownerName: string;
  types: readonly string[];
  initial: PetFields;
}) {
  const [errors, setErrors] = useState<PetFieldErrors>({});
  const redirect = useRedirect();
  const ownerPath = `/owners/${encodeURIComponent(ownerId)}`;

  async function save(pet: PetFields): Promise<void> {
    const res =
      petId === undefined
        ? await sendJson('POST', `/api${ownerPath}/pets`, petBody(pet))
        : await sendJson('PUT', `/api${ownerPath}/pets/${encodeURIComponent(petId)}`, petBody(pet));
    if (res.status === 422) {
      setErrors((res.body as { errors: PetFieldErrors }).errors);
    } else if (res.status === 201 || res.status === 204 || res.status === 404) {
      await redirect(ownerPath, `/api${ownerPath}`);
    } else {
      throw new Error(`Saving pet failed with ${String(res.status)}`);
    }
  }

  return (
    <PetForm
      isNew={petId === undefined}
      ownerName={ownerName}
      types={types}
      initial={initial}
      errors={errors}
      onSubmit={(pet) => {
        void save(pet);
      }}
    />
  );
}

/** `/owners/{ownerId}/pets/new`: an unknown owner makes legacy's `findOwner` throw. */
export function NewPet() {
  const { ownerId = '' } = useParams();
  const owner = useApi<OwnerWithPets>(`/api/owners/${encodeURIComponent(ownerId)}`);
  const types = useApi<PetType[]>('/api/pettypes');

  if (owner && !owner.ok) return <ErrorPage message={owner.error} />;
  return (
    <Layout menu="owners">
      {owner?.ok && types?.ok && (
        <PetFormWithErrors
          key={ownerId}
          ownerId={ownerId}
          petId={undefined}
          ownerName={`${owner.data.firstName} ${owner.data.lastName}`}
          types={types.data.map((t) => t.name)}
          initial={EMPTY_PET}
        />
      )}
    </Layout>
  );
}

/**
 * `/owners/{ownerId}/pets/{petId}/edit`. Like legacy's `initUpdateForm`, the pet is looked up by
 * its id alone and the "Owner" row names the pet's own owner. An unknown pet shows the error
 * page (D4 fix: legacy answers a raw 500).
 */
export function EditPet() {
  const { ownerId = '', petId = '' } = useParams();
  const pet = useApi<PetWithOwner>(
    `/api/owners/${encodeURIComponent(ownerId)}/pets/${encodeURIComponent(petId)}`,
  );
  const types = useApi<PetType[]>('/api/pettypes');

  if (pet && !pet.ok) return <ErrorPage message={pet.error} />;
  return (
    <Layout menu="owners">
      {pet?.ok && types?.ok && (
        <PetFormWithErrors
          key={`${ownerId}/${petId}`}
          ownerId={ownerId}
          petId={petId}
          ownerName={`${pet.data.owner.firstName} ${pet.data.owner.lastName}`}
          types={types.data.map((t) => t.name)}
          initial={{
            name: pet.data.name,
            birthDate: pet.data.birthDate ?? '',
            type: pet.data.type,
          }}
        />
      )}
    </Layout>
  );
}
