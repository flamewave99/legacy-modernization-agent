/** Result of a JSON GET: the body, or the API's 404 `{ error }` message. */
export type Fetched<T> = { ok: true; data: T } | { ok: false; error: string };

/** GETs `/api/...`. A 404 resolves to `{ ok: false }`; any other failure throws. */
export async function getJson<T>(path: string, signal?: AbortSignal): Promise<Fetched<T>> {
  const res = await fetch(path, signal ? { signal } : {});
  if (res.status === 404) {
    const body = (await res.json()) as { error?: unknown };
    return { ok: false, error: typeof body.error === 'string' ? body.error : 'Not found' };
  }
  if (!res.ok) throw new Error(`GET ${path} failed with ${String(res.status)}`);
  return { ok: true, data: (await res.json()) as T };
}
