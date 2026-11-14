/**
 * Errors as values. A fallible function returns a `Result` instead of
 * throwing, and the caller checks it like Go:
 *
 *   const user = await findUser(id);
 *   if (!user.ok) return user;
 *   use(user.value);
 */

/** Every error is a plain object tagged with a `type`, e.g. `{ type: "not_found", id }`. */
export type TaggedError = { readonly type: string };

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E extends TaggedError> = { readonly ok: false; readonly error: E };
export type Result<T, E extends TaggedError> = Ok<T> | Err<E>;

export function ok(): Ok<undefined>;
export function ok<T>(value: T): Ok<T>;
export function ok<T>(value?: T): Ok<T | undefined> {
  return { ok: true, value };
}

/**
 * `const` keeps the tag literal: `err({ type: "not_found" })` is
 * `Err<{ readonly type: "not_found" }>`, not `Err<{ type: string }>`.
 */
export function err<const E extends TaggedError>(error: E): Err<E> {
  return { ok: false, error };
}
