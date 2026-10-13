import { useState, type SubmitEvent } from 'react';
import { useParams } from 'react-router';
import { sendJson } from '../api/client.js';
import { useApi } from '../api/preloaded.js';
import { useRedirect } from '../api/redirect.js';
import { Layout } from '../layout/Layout.js';
import { ErrorPage } from './ErrorPage.js';
import type { OwnerWithPets } from './OwnerDetails.js';

export interface OwnerFields {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
}

export type FieldErrors = Partial<Record<keyof OwnerFields, string>>;

/** Field order and labels of createOrUpdateOwnerForm.jsp; the `name`s are the form contract. */
export const OWNER_FIELDS: readonly { name: keyof OwnerFields; label: string }[] = [
  { name: 'firstName', label: 'First Name' },
  { name: 'lastName', label: 'Last Name' },
  { name: 'address', label: 'Address' },
  { name: 'city', label: 'City' },
  { name: 'telephone', label: 'Telephone' },
];

export const EMPTY_OWNER: OwnerFields = {
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  telephone: '',
};

interface OwnerFormProps {
  /** New shows "New Owner" / "Add Owner"; edit shows "Owner" / "Update Owner", also after a
   *  rejected submit (D2 fix: legacy's re-render lost the id and fell back to the new labels). */
  isNew: boolean;
  initial: OwnerFields;
  errors?: FieldErrors;
  onSubmit: (owner: OwnerFields) => void;
}

// createOrUpdateOwnerForm.jsp with inputField.tag [SPEC §4.4, §6]. Each error sits in the
// `col-sm-10` div that wraps its input, so it is inside the field's innermost container.
export function OwnerForm({ isNew, initial, errors = {}, onSubmit }: OwnerFormProps) {
  const [values, setValues] = useState(initial);

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <>
      <h2>{isNew ? 'New Owner' : 'Owner'}</h2>
      <form className="form-horizontal" id="add-owner-form" method="post" onSubmit={submit}>
        <div className="form-group has-feedback">
          {OWNER_FIELDS.map(({ name, label }) => {
            const error = errors[name];
            const valid = error === undefined && values[name] !== '';
            return (
              <div key={name} className={`form-group ${error === undefined ? '' : 'has-error'}`}>
                <label className="col-sm-2 control-label">{label}</label>
                <div className="col-sm-10">
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
                  {valid && (
                    <span className="fa fa-ok form-control-feedback" aria-hidden="true"></span>
                  )}
                  {error !== undefined && (
                    <>
                      <span
                        className="fa fa-remove form-control-feedback"
                        aria-hidden="true"
                      ></span>
                      <span className="help-inline">{error}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="form-group">
          <div className="col-sm-offset-2 col-sm-10">
            <button className="btn btn-primary" type="submit">
              {isNew ? 'Add Owner' : 'Update Owner'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/**
 * Saves `owner` and resolves to the field errors of a 422, or to `undefined` once it has
 * navigated to the owner's page, as legacy's `redirect:/owners/{id}` does. A PUT to an owner
 * that is gone (404) navigates too: legacy's update changes no row and the redirect target then
 * shows the error page.
 */
function useSaveOwner(ownerId: string | undefined) {
  const redirect = useRedirect();
  const toOwner = (id: string) =>
    redirect(`/owners/${id}`, `/api/owners/${encodeURIComponent(id)}`);
  return async (owner: OwnerFields): Promise<FieldErrors | undefined> => {
    const res =
      ownerId === undefined
        ? await sendJson('POST', '/api/owners', owner)
        : await sendJson('PUT', `/api/owners/${encodeURIComponent(ownerId)}`, owner);
    if (res.status === 422) return (res.body as { errors: FieldErrors }).errors;
    if (res.status === 201) {
      await toOwner(String((res.body as { id: number }).id));
    } else if (ownerId !== undefined && (res.status === 204 || res.status === 404)) {
      await toOwner(ownerId);
    } else {
      throw new Error(`Saving owner failed with ${String(res.status)}`);
    }
    return undefined;
  };
}

/** Form plus the errors of the last rejected submit; the entered values stay in the form. */
function OwnerFormWithErrors({
  ownerId,
  initial,
}: {
  ownerId: string | undefined;
  initial: OwnerFields;
}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const save = useSaveOwner(ownerId);
  return (
    <OwnerForm
      isNew={ownerId === undefined}
      initial={initial}
      errors={errors}
      onSubmit={(owner) => {
        void save(owner).then((rejected) => {
          if (rejected) setErrors(rejected);
        });
      }}
    />
  );
}

/** `/owners/new`. */
export function NewOwner() {
  return (
    <Layout menu="owners">
      <OwnerFormWithErrors ownerId={undefined} initial={EMPTY_OWNER} />
    </Layout>
  );
}

/** `/owners/{id}/edit`: an unknown owner makes legacy's `findOwnerById` throw. */
export function EditOwner() {
  const { ownerId = '' } = useParams();
  const owner = useApi<OwnerWithPets>(`/api/owners/${encodeURIComponent(ownerId)}`);

  if (owner && !owner.ok) return <ErrorPage message={owner.error} />;
  return (
    <Layout menu="owners">
      {owner?.ok && (
        <OwnerFormWithErrors
          key={ownerId}
          ownerId={ownerId}
          initial={{
            firstName: owner.data.firstName,
            lastName: owner.data.lastName,
            address: owner.data.address,
            city: owner.data.city,
            telephone: owner.data.telephone,
          }}
        />
      )}
    </Layout>
  );
}
