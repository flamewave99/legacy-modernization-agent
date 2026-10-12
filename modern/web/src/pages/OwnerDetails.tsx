import { useParams } from 'react-router';
import { useApi } from '../api/preloaded.js';
import { Layout } from '../layout/Layout.js';
import { ErrorPage } from './ErrorPage.js';

// ownerDetails.jsp [SPEC §4.3]. So far only the unknown-owner case: legacy's `findById` throws,
// and the exception page is rendered with HTTP 200 (Fastify already served index.html).
// The details themselves are task 19.
export function OwnerDetails() {
  const { ownerId = '' } = useParams();
  const owner = useApi<unknown>(`/api/owners/${encodeURIComponent(ownerId)}`);

  if (owner && !owner.ok) return <ErrorPage message={owner.error} />;
  return <Layout menu="owners">{null}</Layout>;
}
