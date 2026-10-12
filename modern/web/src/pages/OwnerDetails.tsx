import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { getJson, type Fetched } from '../api/client.js';
import { Layout } from '../layout/Layout.js';
import { ErrorPage } from './ErrorPage.js';

// ownerDetails.jsp [SPEC §4.3]. So far only the unknown-owner case: legacy's `findById` throws,
// and the exception page is rendered with HTTP 200 (Fastify already served index.html).
// The details themselves are task 19.
export function OwnerDetails() {
  const { ownerId = '' } = useParams();
  const [owner, setOwner] = useState<Fetched<unknown>>();

  useEffect(() => {
    const ctrl = new AbortController();
    setOwner(undefined);
    getJson(`/api/owners/${encodeURIComponent(ownerId)}`, ctrl.signal).then(setOwner, () => {
      // Aborted on unmount, or a network failure; nothing to render.
    });
    return () => {
      ctrl.abort();
    };
  }, [ownerId]);

  if (owner && !owner.ok) return <ErrorPage message={owner.error} />;
  return <Layout menu="owners">{null}</Layout>;
}
