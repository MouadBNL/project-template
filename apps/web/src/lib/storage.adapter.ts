import { fromThrowable, type Result } from "@app/result";

type StorageError = { readonly type: "storage_unavailable"; readonly cause: unknown };

const unavailable = (cause: unknown): StorageError => ({ type: "storage_unavailable", cause });

/**
 * localStorage throws when it is disabled (privacy settings, sandboxed frames) or full.
 * These wrappers turn that into a value; callers fall back to a default.
 */
export function readStorage(key: string): Result<string | null, StorageError> {
  return fromThrowable(() => window.localStorage.getItem(key), unavailable);
}

export function writeStorage(key: string, value: string | null): Result<void, StorageError> {
  return fromThrowable(() => {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  }, unavailable);
}
