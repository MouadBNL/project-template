import { contract } from "@app/contracts";
import * as z from "zod";

/*
 * Why an API call failed, as a value typed from the contract.
 *
 *   const health = await fromPromise(() => api.system.health(), failureOf("system.health"));
 *   if (!health.ok && health.error.type === "service_unavailable") health.error.reason;
 *
 * `ApiFailure<"system.health">` holds exactly the errors `system.health` declares in
 * packages/contracts, each as `{ type: <its code, lower case>, ...<its data> }` (so
 * `SERVICE_UNAVAILABLE { reason }` is `{ type: "service_unavailable", reason: "shutting_down" |
 * ... }`), plus what any call can meet: invalid input, no answer, an answer nobody declared.
 * Rename a reason in the contract and every comparison and `Record` over it stops compiling.
 *
 * At run time the same contract object checks what arrived: an error is the declared one only if
 * its data passes the procedure's own schema, so the types never claim more than was checked (an
 * older tab meeting a newer server sees `unexpected`, not an unknown reason).
 */

type Contract = typeof contract;

/** A procedure of the contract: what `oc.input(...).output(...)` builds. */
type ProcedureLike = { readonly "~orpc": { readonly errorMap: object } };

type PathsOf<T, Prefix extends string> = {
  [K in keyof T & string]: T[K] extends ProcedureLike
    ? `${Prefix}${K}`
    : PathsOf<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every procedure, by its path: `"system.health"`, ... */
export type ProcedurePath = PathsOf<Contract, "">;

type ProcedureAt<P extends string, T> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? ProcedureAt<Rest, T[Head]>
    : never
  : P extends keyof T
    ? T[P]
    : never;

type ErrorMapOf<P extends ProcedurePath> =
  ProcedureAt<P, Contract> extends { readonly "~orpc": { readonly errorMap: infer M } } ? M : never;

/** The fields an error declares as its `data` (none when it declares no data). */
type FieldsOf<Item> = Item extends { readonly data: infer S extends z.ZodType }
  ? Readonly<z.output<S>>
  : unknown;

/** Each error `M` declares, as a failure: its code in lower case as `type`, its data as fields. */
type Declared<M> = {
  [Code in keyof M & string]: { readonly type: Lowercase<Code> } & FieldsOf<M[Code]>;
}[keyof M & string];

/** What any call can meet, declared or not: the framework and the network produce these. */
type AnyCallFailure =
  /** The input failed the procedure's schema (oRPC answers BAD_REQUEST before the handler). */
  | { readonly type: "invalid_input" }
  /** No answer from the API: offline, or the server (or the proxy in front of it) is down. */
  | { readonly type: "unreachable" }
  /** An answer we did not expect: a bug on either side, or a reason this build does not know. */
  | { readonly type: "unexpected" };

/**
 * How a call to procedure(s) `P` can fail: `ApiFailure<"system.health">`. Always name the
 * procedures a feature calls; there is no default, because a failure type over every procedure
 * would grow with each error another module declares and break code that has nothing to do with
 * it. Code that words any failure at all writes `ApiFailure<ProcedurePath>`.
 */
export type ApiFailure<P extends ProcedurePath> =
  | (P extends ProcedurePath ? Declared<ErrorMapOf<P>> : never)
  | AnyCallFailure;

const RpcError = z.object({ code: z.string(), status: z.number(), data: z.unknown() });

const INVALID_INPUT = { type: "invalid_input" } as const;
const UNREACHABLE = { type: "unreachable" } as const;
const UNEXPECTED = { type: "unexpected" } as const;

/** Statuses a proxy or load balancer answers with when the API itself did not. */
const GATEWAY_STATUSES = [502, 503, 504];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

/** What `path` declares for `code`, read from the contract object itself; null if nothing. */
function declaration(path: ProcedurePath, code: string): { readonly data: unknown } | null {
  let node: unknown = contract;
  for (const segment of path.split(".")) node = isRecord(node) ? node[segment] : undefined;
  const definition = isRecord(node) ? node["~orpc"] : undefined;
  const errorMap = isRecord(definition) ? definition["errorMap"] : undefined;
  const item = isRecord(errorMap) ? errorMap[code] : undefined;
  return isRecord(item) ? { data: item["data"] } : null;
}

/** `data` parsed by what one of `paths` declares for `code`: its fields, or null if none does. */
function parseDeclared(
  code: string,
  data: unknown,
  paths: readonly ProcedurePath[],
): Readonly<Record<string, unknown>> | null {
  for (const path of paths) {
    const declared = declaration(path, code);
    if (declared === null) continue;
    if (!(declared.data instanceof z.ZodType)) return data === undefined ? {} : null;
    const parsed = declared.data.safeParse(data);
    if (parsed.success && isRecord(parsed.data)) return parsed.data;
  }
  return null;
}

/** A failure as it arrived: its type and its fields, not yet checked against a declaration. */
type Arrived = { readonly type: string; readonly [field: string]: unknown };

/**
 * True when one of `paths` declares this failure's code and its fields pass that declaration:
 * then it is, by construction, one of the variants `ApiFailure<P>` computes from it.
 */
function isDeclaredBy<P extends ProcedurePath>(
  failure: Arrived,
  paths: readonly P[],
): failure is Extract<ApiFailure<P>, Arrived> {
  const { type, ...fields } = failure;
  const data = Object.keys(fields).length === 0 ? undefined : fields;
  return parseDeclared(type.toUpperCase(), data, paths) !== null;
}

/**
 * The `fromPromise` mapper for a call to `paths` (usually one): turns what the oRPC client
 * rejected with into an `ApiFailure` of those procedures.
 *
 *   fromPromise(() => api.system.health(), failureOf("system.health"))
 */
export function failureOf<const P extends ProcedurePath>(
  ...paths: readonly P[]
): (cause: unknown) => ApiFailure<P> {
  return (cause) => {
    const error = RpcError.safeParse(cause);
    // Not an oRPC error: `fetch` itself failed (offline, connection refused).
    if (!error.success) return UNREACHABLE;
    const { code, status, data } = error.data;
    const fields = parseDeclared(code, data, paths);
    if (fields !== null) {
      const failure: Arrived = { ...fields, type: code.toLowerCase() };
      if (isDeclaredBy(failure, paths)) return failure;
    }
    if (code === "BAD_REQUEST") return INVALID_INPUT;
    return GATEWAY_STATUSES.includes(status) ? UNREACHABLE : UNEXPECTED;
  };
}
