# Errors as values

Fallible code returns a `Result` instead of throwing. The type lives in
`packages/result/src/result.ts` and is imported from `@app/result`:

```ts
type Result<T, E extends TaggedError> = { ok: true; value: T } | { ok: false; error: E };
ok(value); // Ok<T>
err({ type: "not_found", id }); // Err<{ readonly type: "not_found"; readonly id: string }>
```

Call sites check, return early, and continue with the value:

```ts
const user = await findUser(id);
if (!user.ok) return user; // propagate: Err<NotFound> is assignable to any Result<_, NotFound | ...>
use(user.value);
```

Errors are plain objects with a literal `type` tag (`err` uses a `const` type parameter so the
tag stays literal), never `Error` subclasses. Callers branch with `switch (r.error.type)`; the
`typescript/switch-exhaustiveness-check` lint makes them handle every variant.

Why: a thrown error is invisible in a function's type, so neither the caller nor an agent reading
the signature knows it can happen, and a `catch` far away handles it by accident or not at all.
A `Result` puts every expected failure in the signature, and the type checker follows it from the
database to the screen.

**Narrowing tip.** Checking `r.error.type` narrows the error, not the `Result`: after
`if (!r.ok && r.error.type === "a") return ...`, returning `r` still has the type with `"a"` in
it. To return a narrower error, build a new one: `return err(r.error)` inside the branch where
`r.error` is narrowed, or map the variants with a small function that returns `Err<...>`.

## Adapters: the only place that throws or catches

`throw`, `try`/`catch` and promise `.catch()` are banned by `repo/no-throw` everywhere except files
named `*.adapter.ts` and their own tests (`*.adapter.test.ts`). So are the other ways to throw or
catch with promises: a rejection handler (`.then(onOk, onErr)`), `Promise.reject(...)`, the
`reject` of `new Promise` or `Promise.withResolvers()`, and `class X extends Error`. Zod's
`.catch(fallback)` is not a promise and is allowed (`docs/conventions.md` says how the rule tells
them apart). Adapter files wrap third-party code that throws, and nothing else; `repo/boundaries`
keeps them from importing an API module or a web feature, so business rules cannot hide in them.

Usually you do not need to write `try` at all; use the helpers from
`packages/result/src/capture.adapter.ts`:

```ts
import { fromPromise, fromThrowable } from "@app/result";

const parsed = fromThrowable(
  (): unknown => JSON.parse(text),
  (cause) => ({ type: "invalid_json", cause }) as const,
);

const response = await fromPromise(
  () => fetch(url),
  (cause) => ({ type: "network_error", cause }) as const,
);
```

`fromPromise` takes a thunk, so a synchronous throw while creating the promise is captured too.
Libraries that already return values (Zod's `safeParse`, oRPC's `safe`) need no adapter.

The adapters in the template, each wrapping one library that throws:

| File                                     | Wraps                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/result/src/capture.adapter.ts` | any throwing call: `fromThrowable`, `fromPromise`                                     |
| `packages/db/src/client.adapter.ts`      | the database drivers: `createDb()` and `migrate()` return `Result`                    |
| `packages/db/src/query.adapter.ts`       | Drizzle queries: `tryQuery` returns constraint violations and an unreachable database |
| `packages/db/src/snapshot.adapter.ts`    | the test database's on-disk snapshot (file system)                                    |
| `apps/api/src/orpc/result.adapter.ts`    | oRPC's thrown errors: `orThrow`, used by `respond`                                    |
| `apps/web/src/lib/query.adapter.ts`      | TanStack Query's thrown `queryFn` failures: `unwrapForQuery`                          |
| `apps/web/src/lib/storage.adapter.ts`    | `localStorage`, which throws when storage is disabled                                 |
| `e2e/src/*.adapter.ts`                   | child processes and the throwaway Postgres container of the e2e suite                 |
| `tools/*/src/*.adapter.ts`               | the file system and child processes of the canary and the rename tool                 |

## Expected failures and defects

Not every failure is a value. **Expected** failures are the ones a caller can act on: a missing
row, a constraint the input violated, the server shutting down, the database not answering. They
are tagged errors in a `Result`, and the contract declares the ones the client sees. **Defects**
are bugs: a syntax error in SQL, a missing table, a library throwing where it should not. They are
not modelled: `tryQuery` rethrows them, nothing catches them, and the API answers an undeclared
`INTERNAL_SERVER_ERROR` (`apps/api/src/app.ts` logs it). Catching a defect to turn it into a value
hides the bug; let it reach the top.

Between the two sits the **unexpected value**: a repo got a `Result` it has no mapping for (a
constraint no code expects, an insert that returned no row). It cannot throw (it is not an
adapter), so it returns an `Unexpected` error that `respond` turns into the same undeclared 500.
The template has no repo yet, so it has no `Unexpected`; add it with the first one ("Recipe: a
shared error" below).

## Through the API to the client

oRPC reports a procedure's expected errors by throwing them, so the conversion happens at one
adapter, `apps/api/src/orpc/result.adapter.ts`. The health check is the worked example.

1. **Declare** expected errors in the contract. `system.health` reuses a shared declaration from
   `packages/contracts/src/errors.ts`:

   ```ts
   // packages/contracts/src/errors.ts
   export const SERVICE_UNAVAILABLE = {
     status: 503,
     message: "The service is temporarily unavailable",
     data: z.object({ reason: z.enum(UNAVAILABLE_REASONS) }),
   };
   // packages/contracts/src/system.ts
   const health = oc.output(HealthStatus).errors({ SERVICE_UNAVAILABLE });
   ```

   The key is the code the client sees; `data` is validated on the server before it is sent.

2. **Return** a `Result` from the service (`apps/api/src/modules/system/health.ts`): the
   shutting-down flag and a database ping that fails are both `unavailable(reason)`
   (`apps/api/src/errors.ts`), not throws.

3. **Map** it in the handler with `respond` (`apps/api/src/orpc/procedures.ts`). `respond` maps
   the errors every service shares (`SharedError` in `apps/api/src/errors.ts`, today
   `Unavailable` to `SERVICE_UNAVAILABLE`) by itself; its last argument maps only the module's
   own errors, and the type checker requires it exactly when the service can return one:

   ```ts
   os.system.health.handler(async ({ context, errors }) =>
     respond(await checkHealth(context), errors),
   );
   os.notes.create.handler(async ({ context, input, errors }) =>
     respond(await createNote(context, input), errors, (error) =>
       errors.CONFLICT({ data: { reason: error.type } }),
     ),
   );
   ```

   `errors` only offers codes the procedure declares, so this is type-checked. Give service
   functions an explicit `Promise<Result<T, A | B>>` return type: inferred from several
   `return`s, `respond` sees only part of the error union.

4. **Handle** it on the client as a value typed from the contract (`apps/web/src/lib/api-failure.ts`):
   the feature's `api/` calls the client through `fromPromise(..., failureOf("system.health"))`,
   which turns what the oRPC client rejected with into an `ApiFailure<"system.health">`:

   ```ts
   type HealthFailure = ApiFailure<"system.health">;
   // = { type: "service_unavailable"; reason: "shutting_down" | "database_unavailable" }
   //   | { type: "invalid_input" } | { type: "unreachable" } | { type: "unexpected" }
   ```

   Each declared code becomes `{ type: <code in lower case>, ...<its data> }`; the last three are
   what any call can meet (the input failed the schema, no answer, an answer nobody declared). A
   declared error whose data fails the procedure's schema arrives as `unexpected`, so the type
   never claims more than was checked. `ApiFailure` has no default: always name the procedures
   the feature calls, or a failure type grows with every error another module declares. With
   TanStack Query the failure is `query.error` (`unwrapForQuery`, `apps/web/src/lib/query.adapter.ts`);
   for an action it is the `Err` of the `Result` the `api/` function returns.

5. **Word** it once, in the feature's `model/`, with a `Record` over the reason union
   (`apps/web/src/features/system/model/health.ts`), so a reason added in the contract does not
   compile on the client until it has a sentence.

API tests check the declared error directly: `const [error] = await safe(t.client.x.y())`, then
`isDefinedError(error)` and `toMatchObject({ code, status, data })` (`docs/backend.md`, "Tests").

Renaming a reason in the contract fails the type check of the service that returns it, of the
router that maps it, and of every client `Record` and branch that names it.

## Recipe: a contract error

For an expected failure of one procedure that the user can act on (a taken name, a stale
version). The example is a `notes.create` that refuses a title another note has.

1. **Declare it** in the procedure's contract file, `packages/contracts/src/<module>.ts`. A
   failure the user fixes by changing the input is a `CONFLICT` with a closed list of reasons:

   ```ts
   const CONFLICT = {
     status: 409,
     message: "The note conflicts with an existing one",
     data: z.object({ reason: z.enum(["title_taken"]) }),
   };
   const create = oc.input(NewNote).output(Note).errors({ SERVICE_UNAVAILABLE, CONFLICT });
   ```

   Keep it in that file while one module uses it; when a second needs the same shape, move a
   builder to `packages/contracts/src/errors.ts`. Export from `packages/contracts/src/index.ts`
   only what another package imports (Knip reports the rest). Invalid input needs no declared
   error: oRPC validates the input schema before the handler and answers `BAD_REQUEST`, which the
   web sees as `invalid_input`.
   Verify: `vp -C packages/contracts check`.

2. **Return it** from the repo or service as a tagged error whose `type` is the reason:
   `export type TitleTaken = { readonly type: "title_taken" }`, `return err({ type: "title_taken" })`,
   with the service's return type naming it. Verify: `vp -C apps/api check` (the router now fails
   until step 3).
3. **Map it** in the router with `respond`'s last argument:
   `(error) => errors.CONFLICT({ data: { reason: error.type } })`. Verify: `vp -C apps/api check`.
4. **Test it** through the API: one test per declared error, asserting `isDefinedError(error)` and
   `toMatchObject({ code: "CONFLICT", status: 409, data: { reason: "title_taken" } })`. Verify:
   `vp -C apps/api test src/modules/<module>`.
5. **Word it** on the web: `ApiFailure<"notes.create">` now holds
   `{ type: "conflict"; reason: "title_taken" }`; add the sentence to the feature's `model/`
   `Record` over the reasons and show it where it belongs (a reason about a field under that
   field). Verify: `vp -C apps/web check` (a `Record` missing the reason does not compile) and
   `vp -C apps/web test`.

## Recipe: a shared error

For an error many services return and `respond` maps by itself. The template has one,
`Unavailable`. The first repo needs a second, `Unexpected`; this is the recipe for it, and for any
other (`NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN` once the product has them):

1. **Service-side type and constructor** in `apps/api/src/errors.ts`, and add it to `SharedError`:

   ```ts
   /** A value the code did not expect (an unmapped constraint, an insert with no row): a bug. */
   export type Unexpected = { readonly type: "unexpected"; readonly detail: string };
   export type SharedError = Unavailable | Unexpected;
   export const unexpected = (detail: string): Err<Unexpected> =>
     err({ type: "unexpected", detail });
   ```

2. **Map it** in `apps/api/src/orpc/procedures.ts`: add its schema to `SharedErrorSchema`, a
   branch to `sharedError`, and, if it becomes a declared contract error, its constructor to
   `SharedErrorMap` and `ErrorsFor`. `Unexpected` is not declared: it stays an undeclared 500.

   ```ts
   z.object({ type: z.literal("unexpected"), detail: z.string() }),   // in SharedErrorSchema
   if (error.type === "unexpected") return defect(error);              // first line of sharedError
   ```

3. **Declare it once** in `packages/contracts/src/errors.ts` if the client sees it (not for
   `Unexpected`), and list it in each procedure's `.errors({...})` that can return it.
4. **Test** `respond` with it in `apps/api/src/orpc/procedures.test.ts` (for `Unexpected`: the
   thrown error has `code: "INTERNAL_SERVER_ERROR"`, `status: 500`, `defined: false`). Verify:
   `vp -C apps/api test src/orpc`.
5. Add the helper together with its first caller: Knip reports an export nobody uses.

## Conflicts, reasons and words as the product grows

- **A conflict per procedure, reasons as literals**, as in "Recipe: a contract error". The
  service returns `{ type: "<reason>" }`; the router maps it with `respond`'s last argument.
- **Every reason worded once**, in a `Record` over the reason union in a `model/` file, so a new
  reason does not compile until it has a sentence, and every screen shows the same one.
- **Predicted refusals.** A screen that can see a refusal coming (a name it knows is taken) builds
  the same failure value the server would answer, so it is placed and worded by the same code.
