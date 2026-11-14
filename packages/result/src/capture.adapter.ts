/**
 * The only bridge from throwing code to `Result`. Use these at the edge where
 * a third-party library (or the platform) throws or rejects, and map the
 * unknown cause to one of your tagged errors right there.
 *
 * This file is an adapter (`*.adapter.ts`), so it is allowed to use
 * try/catch. Everything else in the repo must not.
 */
import { err, ok, type Result, type TaggedError } from "./result.ts";

/** Runs a function that may throw synchronously. */
export function fromThrowable<T, E extends TaggedError>(
  fn: () => T,
  toError: (cause: unknown) => E,
): Result<T, E> {
  try {
    return ok(fn());
  } catch (cause) {
    return err(toError(cause));
  }
}

/**
 * Runs a function returning a promise that may reject. Takes a thunk rather
 * than a promise so a synchronous throw while creating the promise is
 * captured too.
 */
export async function fromPromise<T, E extends TaggedError>(
  fn: () => PromiseLike<T>,
  toError: (cause: unknown) => E,
): Promise<Result<T, E>> {
  try {
    return ok(await fn());
  } catch (cause) {
    return err(toError(cause));
  }
}
