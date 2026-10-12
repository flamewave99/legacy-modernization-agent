import { ErrorPage } from './ErrorPage.js';

/** The exact message CrashController throws. */
export const OUPS_MESSAGE =
  'Expected: controller used to showcase what happens when an exception is thrown';

// CrashController's `/oups` always throws; the exception resolver renders exception.jsp.
export function Oups() {
  return <ErrorPage message={OUPS_MESSAGE} />;
}
