# Testing

Vitest through Vite+ (`vp test`). Import test APIs from `vite-plus/test`, not `vitest`
(**[check]** `vite-plus/prefer-vite-plus-imports`). `vp test` is Vite+'s built-in command and
prints a note suggesting `vpr test` for the package script; for one package either works, and
`pnpm check` runs the scripts.

## Where tests live

Next to the code they test, named `<file>.test.ts` (or `.test.tsx`). Test files follow the same lint
rules as source: no `throw`/`try`/`.catch()` (assert on `Result` values, use `safe` for oRPC calls),
no `any`, no `as` casts, no `.only`/`.skip`, no conditional `expect`, no early `return` under a
condition (narrow with `assert(row !== undefined)` instead), no snapshots, no test ids, no
`.concurrent`, typed mocks (`vi.fn<() => Response>()`). Only an adapter's own test
(`*.adapter.test.ts`) may throw or reject. The full list, with the rule behind each:
`docs/conventions.md`, "Tests".

## Kinds of tests

| Kind                       | Example                                                          | Notes                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                       | `packages/result/src/result.test.ts`                             | Pure functions. `expectTypeOf` for type-level guarantees.                                                                               |
| API procedure (in-process) | `apps/api/src/modules/system/system.test.ts`                     | No port, no mocks. `createTestApp()` (`apps/api/src/testing/test-app.ts`): fresh database, a typed client whose `fetch` is `app.fetch`. |
| `respond` mapping          | `apps/api/src/orpc/procedures.test.ts`                           | How each shared error becomes a declared (or undeclared) oRPC error.                                                                    |
| Database / repo            | `packages/db/src/query.adapter.test.ts`                          | `createTestDb()` from `@app/db/testing`: an empty, migrated database per call, about 1 ms. Assert constraint violations as `Result`s.   |
| Lint rule                  | `tools/oxlint-plugin/src/boundaries.test.ts`                     | `RuleTester` from `vite-plus/lint/plugins-dev`, wired to Vitest in `src/rule-tester.ts`. Proves the rule's logic.                       |
| Canary                     | `tools/canary/src/cases/*.ts`                                    | Proves the root config applies each rule where the docs say. See "The canary".                                                          |
| Workspace manifests        | `tools/workspace-check/src/catalog.test.ts`                      | Every dependency of every `package.json` is `catalog:` or `workspace:*` (pnpm checks that only for `pnpm add`).                         |
| Web model (pure)           | `apps/web/src/features/system/model/health.test.ts`              | Plain functions in Node, no DOM (the `unit` project). Most frontend logic should be tested here.                                        |
| Web lib                    | `apps/web/src/lib/api-failure.test.ts`                           | The failure type computed from the contract, and `failureOf` on what the client can reject with.                                        |
| Web component / hook       | `apps/web/src/features/system/components/system-status.test.tsx` | happy-dom + Testing Library (the `dom` project), `renderWithApp`, `fetch` stubbed with `rpcOutput` / `rpcError`. See "Frontend tests".  |
| Design-system primitive    | `packages/ui/src/button.test.tsx`                                | happy-dom + Testing Library + user-event. Test behaviour the component adds (keyboard, ARIA, states), not markup.                       |
| Journey (browser)          | `e2e/tests/health.spec.ts`                                       | Playwright on a production build and the real API. See "End-to-end".                                                                    |

Tests that touch the database get it from `createTestDb()` (directly or through `createTestApp()`).
Each worker boots one in-memory PGlite, from a migrated snapshot cached in the OS temp dir (rebuilt
when migrations change), and every call empties it. So: call it in each test, never use
`.concurrent`, and keep `test.isolate: false` in the package's `vite.config.ts` (as `apps/api` and
`packages/db` do) so the database survives across test files.

The boot happens in a setup file, not in the first test: `src/test-setup.ts` of `packages/db` and
`apps/api` boots the database in a `beforeAll` with a generous time limit. Paid in the first test
instead, it costs that test about a second and can time out at Vitest's 5 s on a loaded machine.
Keep heavy one-off setup out of test bodies the same way.

## The canary

A lint rule can be correct and still not run: an override that matches the wrong glob, a later
override that switches it off, a boundary whose path was renamed, a rule removed from the config
during a refactor. The rule's own tests pass in all of these cases, because they test the rule,
not the config. The canary tests the config.

`tools/canary` holds one case per convention the docs claim a lint rule enforces (48 today, 169
samples). A case (`tools/canary/src/case.ts`) is the convention in words, where `vite.config.ts`
configures it, and inline samples: `fires(path, code, ...rules)` must report exactly those rule
ids, `passes(path, code)` must report nothing (a path the config exempts). Each sample's `path`
is the repo path it stands for, such as `apps/web/src/features/x/model/clock.ts` for
`repo/pure-model`; the canary writes every sample into a temporary copy of the repo's layout and
lints them all at once with the real root `vite.config.ts`.

It fails when:

- a violating sample is not reported with its rule, or reports another one;
- a compliant sample reports anything;
- a case names a rule id that does not exist;
- `vite.config.ts` turns on a rule (in `rules` or an override) that no case proves, unless
  `UNCOVERED` in `tools/canary/src/cases/index.ts` lists it with the reason (today:
  `react/preserve-manual-memoization`, `react/syntax`); and when `UNCOVERED` lists a rule a case
  proves or that is not on;
- a size limit changes: each limit is probed at its edge (`sized()` in `case.ts`).

It runs as the `test` script of `tools/canary` (Vitest for its own logic, then
`node src/main.ts`), so it is part of `pnpm check`. Standalone: `node tools/canary/src/main.ts`,
about 2.5 s. What it proves: for each case, that the root config still applies that rule at that
kind of path. What it does not prove: that the rule catches every variant (the rule's
`RuleTester` tests do that), or anything that is not a lint rule (types, Knip, jscpd, oxfmt, the
catalog; see the Canary column of `docs/conventions.md`).

### Recipe: a lint rule and its canary case

1. **The rule.** `tools/oxlint-plugin/src/<name>.ts` exporting a `Rule` (copy
   `no-process-env.ts`): `meta.messages` say what to do instead and name the doc that explains
   why. Register it in `tools/oxlint-plugin/src/index.ts` under its kebab-case name; it is then
   `repo/<name>`.
2. **Its tests.** `tools/oxlint-plugin/src/<name>.test.ts` with `ruleTester.run(...)`
   (`src/rule-tester.ts`): valid and invalid code, every variant the rule must see. Verify:
   `vp -C tools/oxlint-plugin test`.
3. **Turn it on** in the root `vite.config.ts`, in `lint.rules` or in the override for the files
   it applies to (an override that uses a plugin's rule also lists the plugin). Verify: `vp check`
   on a file that violates it.
4. **The canary case.** Add a case to the matching file in `tools/canary/src/cases/` (or a new
   file listed in `cases/index.ts`): a `fires(...)` sample at a path where the rule must apply,
   written as you would find it in real code, and a `passes(...)` sample where the config exempts
   it. Run `node tools/canary/src/main.ts` and see it pass; switch the rule off in
   `vite.config.ts`, see the canary fail, switch it back. A case never seen failing proves
   nothing. A boundary or a new place an existing rule must apply is a new sample in the same way.
5. **The row** in `docs/conventions.md`, with "yes" in its Canary column. Verify: `pnpm check`.

## Real Postgres

PGlite is one connection in one process, so requests never overlap in the database: a race between
a check and a write cannot show. `pnpm test:postgres` (Docker needed, about a minute) starts a
throwaway Postgres container under a random name and port (`e2e/src/postgres.adapter.ts`), runs
the `packages/db` and `apps/api` suites on it (`TEST_DATABASE_URL`: each worker creates its own
database there, and requests within a test use a connection pool, so they run truly in
parallel), runs the e2e suite with the API on Postgres, and removes the container.

Run it after touching transactions, locks, invariants or the schema. A test of a concurrency
invariant passes on PGlite trivially; it means something only there, and only if it was seen
failing with its lock removed. To run one suite on your own throwaway server:
`TEST_DATABASE_URL=postgres://... vp -C apps/api test` (the role must be a superuser; the
databases each worker creates are left behind).

## End-to-end

`e2e/` is a Playwright suite, run by `pnpm e2e`, deliberately **not** part of `pnpm check` (CI
runs it as its own job). `e2e/src/stack.adapter.ts` (the `globalSetup`) prepares a throwaway
PGlite directory in the OS temp dir, builds the web app for production, starts the API
(`E2E_API_PORT`, default 3461) and `vite preview` (`E2E_WEB_PORT`, 5461), and on exit or Ctrl-C
stops exactly what it started and deletes the directory. It reads no `.env` (`e2e/src/env.ts`),
so it runs next to `pnpm dev`. Failed journeys keep a trace and a screenshot in
`e2e/test-results/` (`pnpm -C e2e exec playwright show-trace <trace.zip>`).

The template has one journey, `e2e/tests/health.spec.ts`: the app loads, shows a healthy API, and
keeps a picked theme across a reload. Add a journey for each flow a user performs end to end, in
`e2e/tests/<name>.spec.ts`. Journeys share one database and run in parallel: create what you
change, with unique names (`crypto.randomUUID()` in the title), and assert on what you created,
not on counts.

Find everything by role and accessible name (`getByRole("button", { name: "Save" })`); no test
IDs. If a screen cannot be driven that way it is an accessibility bug: fix the app. Lint rules are
those of the repo (type-aware, no floating promises, no `any`, no casts). Exceptions, as for the
other tool configs: `playwright.config.ts` and `src/stack.adapter.ts` have default exports (the
tool loads them), `src/env.ts` reads `process.env`, and the `*.adapter.ts` files manage processes
and may throw. oxlint's vitest rules do not recognise `@playwright/test`, so `repo/test-hygiene`
(with `playwright: true`) does their job for `tests/*.spec.ts`: no `.only`, `.skip` or `.fixme`,
every test asserts, no assertion under a condition. Playwright refuses `.only` at run time too
(`forbidOnly`).

## Frontend tests

Pure logic lives in `model/` and is tested as plain functions: `*.test.ts` files in `apps/web` run
in the `unit` project, in Node, with no DOM (`apps/web/vite.config.ts`). Components and hooks get
a test only when they hold behaviour of their own (a form flow, a keyboard listener, a state a
query can be in); `*.test.tsx` files run in the `dom` project under happy-dom. `packages/ui` runs
everything under happy-dom.

A component test renders through `renderWithApp(ui)` (`apps/web/src/testing/render-with-app.tsx`:
a memory router and a fresh QueryClient) and answers the API by stubbing the global `fetch`, so
the real oRPC client, its serializer and `failureOf` run as in the app
(`apps/web/src/testing/rpc-responses.ts`):

```tsx
vi.stubGlobal("fetch", async (request: Request) =>
  request.url.endsWith("/notes/create")
    ? rpcError("CONFLICT", 409, { reason: "title_taken" })
    : rpcOutput(
        notes,
        notes.map((_, index) => [index, "createdAt"]),
      ),
);
await renderWithApp(<Notes />);
```

`rpcOutput(value, dates)` takes an object or a list and the paths of its `Date`s (a top-level
field name, or a path such as `[0, "createdAt"]`); `rpcError(code, status, data)` is a declared
error as the server sends it. Unstub in `afterEach` (`vi.unstubAllGlobals()`).

Why happy-dom and not Vitest browser mode: measured on the design system's suite, one test file
took about 1.4 s wall clock under happy-dom against 3.5 s in browser mode (Playwright +
Chromium), and happy-dom needs no browser binary on the machine. The price is fidelity: no
layout, no real focus or animation timing. So query by role and label, use
`@testing-library/user-event` rather than `fireEvent`, and wait for things that animate out
(`waitFor`) instead of asserting synchronously. Visual checks belong in a real browser, by hand.

Write component tests like a user: `screen.getByRole("button", { name: "Save" })`,
`getByLabelText("Name")`, `userEvent.type(...)`. No snapshots (**[check]**
`vitest/no-restricted-matchers`), no class-name assertions. Testing Library's cleanup is
registered in each package's `src/test-setup.ts` (no Vitest globals).

A package without tests has no `test` script. Add
`"test": "vp test --no-cache --no-fsModuleCache"` to the package's `package.json` with its first
test. Both flags turn off Vitest's own on-disk caches, whose temp files make Vite+ refuse to cache
the task; Vite+ then caches the whole test run per package instead.

## Speed of the check loop

`pnpm check` runs, in order: `vp run -r check:static` (format, lint, type check per package, and
the root's config files and docs), `vp run -r test` (every package's tests, including the canary
and the workspace check), `vp run knip` (twice: with and without tests, `knip.config.ts`) and
`vp run duplicates` (jscpd). Each is a Vite+ task cached on the files it read.

Measured on an 8-core Linux machine, template as shipped:

| Run                                                    | Wall clock |
| ------------------------------------------------------ | ---------- |
| `pnpm check`, cold (after `vp cache clean`)            | 26 s       |
| `pnpm check`, nothing changed (every task a cache hit) | 1 s        |
| `pnpm check` after a one-line change in `apps/web/src` | 9 s        |
| `pnpm e2e` (production build, API, one journey)        | 6 s        |
| `node tools/canary/src/main.ts`                        | 2.5 s      |
| `vp -C apps/web check` / `vp -C apps/api test`         | 2 s each   |

After a one-file change only the tasks whose inputs changed rerun (that package's `check:static`
and `test`, and Knip and jscpd, which read the whole repo). So during work run the narrowest
command (`AGENTS.md`, "Fastest loop"), and `pnpm check` at the end. In a grown product the biggest
costs are the API suite (database round trips) and the web `dom` tests, half of whose time is the
React Compiler's Babel transform. It stays in tests on purpose: tests run the components as they
ship.

Cache keys depend only on inputs. Vite+ fingerprints every environment variable a config loads, so
`apps/web/vite.config.ts` loads only `API_PORT` and `WEB_PORT` (a `""` prefix would load the whole
environment, and any shell or agent variable would then miss the web test and Knip caches). The
`knip` task in the root `vite.config.ts` ignores jiti's transpile cache in `node_modules/.cache`.
A cache miss names its cause (`vp run --last-details`); if a second run right after the first
misses, the task's inputs are wrong: fix them, never `--no-cache` in scripts.

## Running

```sh
pnpm check                                        # everything, cached per package
pnpm e2e                                          # browser journeys (not in check)
pnpm test:postgres                                # API, db and e2e on real Postgres (Docker)
vp run -r test                                    # all tests, cached per package
vp -C apps/api test                               # one package
vp -C packages/result test src/result.test.ts     # one file
vp -C apps/api test system -t "shutting down"     # filter by path and test name
vp -C apps/web test --project unit                # only the fast Node tests of the web app
node tools/canary/src/main.ts                     # the canary alone
```

The pre-commit hook can be skipped once with `git commit --no-verify`, or for a machine with
`VP_GIT_HOOKS=0`; CI runs the same checks, so a skipped hook only moves the failure later.
