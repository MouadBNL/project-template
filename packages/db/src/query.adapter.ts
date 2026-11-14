/**
 * Database failures as values. Drizzle throws a `DrizzleQueryError` whose `cause` is the driver's
 * error (PGlite and node-postgres both expose the Postgres SQLSTATE `code` and the `constraint`
 * name; node-postgres also passes on the socket's error code when it cannot connect).
 *
 * `tryQuery` sorts them in three:
 * - a constraint the schema declares rejected the write: `Err<ConstraintViolation>`, for the repo
 *   to turn into an error of its own (a taken name, a missing parent);
 * - the database cannot be reached (connection refused or lost, server shutting down):
 *   `Err<DbUnavailable>`, which a service reports as "unavailable, try again";
 * - anything else (a syntax error, a missing table, a bug): a defect, rethrown untouched, so it
 *   reaches the API's top-level handler and becomes a 500. Do not catch it anywhere else.
 *
 * "Not found" is not an exception: a repo checks for the missing row itself.
 */
import { err, ok, type Result } from "@app/result";
import { DrizzleQueryError } from "drizzle-orm/errors";
import * as z from "zod";
import type { DbUnavailable } from "./client.adapter.ts";

/** SQLSTATE codes that mean "a declared constraint rejected this write". */
const VIOLATIONS = {
  "23505": "unique_violation",
  "23503": "foreign_key_violation",
  "23514": "check_violation",
  "23502": "not_null_violation",
} as const;

/**
 * Codes that mean "the database is not there right now", besides Postgres' connection exceptions
 * (class 08): shutdown and too-many-connections states, and Node's socket errors from the driver.
 */
const UNAVAILABLE = new Set([
  "57P01",
  "57P02",
  "57P03",
  "53300",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "EPIPE",
]);

type ViolationType = (typeof VIOLATIONS)[keyof typeof VIOLATIONS];

export type ConstraintViolation = {
  readonly type: ViolationType;
  /** Constraint name, e.g. `users_email_unique`; compare against constants the schema exports. */
  readonly constraint: string;
  readonly table: string | undefined;
  /** Postgres' explanation ("Key (email)=(a@b.c) already exists."). Do not show it to users. */
  readonly detail: string | undefined;
};

/** What `tryQuery` returns instead of throwing. */
export type QueryFailure = ConstraintViolation | DbUnavailable;

const DriverError = z.object({
  code: z.string(),
  constraint: z.string().optional(),
  column: z.string().optional(),
  table: z.string().optional(),
  detail: z.string().optional(),
});

const isViolationCode = (code: string): code is keyof typeof VIOLATIONS =>
  Object.hasOwn(VIOLATIONS, code);

const isUnavailableCode = (code: string): boolean => code.startsWith("08") || UNAVAILABLE.has(code);

/** Classifies a thrown value; `undefined` when it is a defect. */
function toQueryFailure(thrown: unknown): QueryFailure | undefined {
  const cause = thrown instanceof DrizzleQueryError ? thrown.cause : thrown;
  const parsed = DriverError.safeParse(cause);
  if (!parsed.success) return undefined;
  const { code, constraint, column, table, detail } = parsed.data;
  if (isUnavailableCode(code)) return { type: "db_unavailable", cause };
  if (!isViolationCode(code)) return undefined;
  // not-null violations name the column instead of a constraint.
  return { type: VIOLATIONS[code], constraint: constraint ?? column ?? "", table, detail };
}

/**
 * Runs a query; constraint violations and an unreachable database come back as values, anything
 * else is rethrown (a defect):
 *
 *   const inserted = await tryQuery(() => db.insert(users).values(row).returning());
 *   if (!inserted.ok && inserted.error.type === "unique_violation") ...
 */
export async function tryQuery<T>(run: () => PromiseLike<T>): Promise<Result<T, QueryFailure>> {
  try {
    return ok(await run());
  } catch (thrown) {
    const failure = toQueryFailure(thrown);
    if (failure === undefined) throw thrown;
    return err(failure);
  }
}
