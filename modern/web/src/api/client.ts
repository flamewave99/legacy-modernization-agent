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

/** Status and parsed JSON body (`undefined` when empty) of a write request. */
export interface Sent {
  status: number;
  body: unknown;
}

/** Sends `body` as JSON. Any status resolves; only a network failure throws. */
export async function sendJson(method: 'POST' | 'PUT', path: string, body: unknown): Promise<Sent> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as unknown) : undefined };
}
