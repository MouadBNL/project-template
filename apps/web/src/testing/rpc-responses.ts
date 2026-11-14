/**
 * What the API sends over `/rpc`, for tests that stub `fetch` (`vi.stubGlobal("fetch", ...)`):
 * the real client, its serializer and `failureOf` then run exactly as in the app.
 */

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Where a `Date` sits in an output: a top-level field, or a path into it (`[0, "createdAt"]`). */
type DatePath = string | readonly (string | number)[];

/**
 * A procedure's output, an object or a list. `dates` names where the `Date`s are, so they arrive
 * as `Date`s on the client: `rpcOutput(note, ["createdAt"])`,
 * `rpcOutput(notes, notes.map((_, i) => [i, "createdAt"]))`.
 */
export function rpcOutput(value: unknown, dates: readonly DatePath[] = []) {
  const meta = dates.map((path) => [1, ...(typeof path === "string" ? [path] : path)]);
  return json(200, { json: value, meta });
}

/** A declared contract error, as the server sends it. */
export function rpcError(code: string, status: number, data?: unknown): Response {
  return json(status, { json: { defined: true, code, status, message: code, data } });
}
