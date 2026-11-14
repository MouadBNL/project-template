# Conventions and what enforces them

Every convention stated in `AGENTS.md` and `docs/*.md`, where it is written, and what checks it.
Consult it when a check fails (find the rule id in the message, read why the rule exists) and to
see what is guaranteed. This file is the contract of the template: its rows match the root
`vite.config.ts` rule by rule, and its Canary column matches `tools/canary/src/cases/*.ts` and
the `UNCOVERED` list in `tools/canary/src/cases/index.ts`.

- **Enforced** means `pnpm check` fails on a violation.
- **Guideline** means nothing fails: review discipline, with the reason a tool does not check it.
- **Canary** says whether `tools/canary` proves it (`docs/testing.md`, "The canary"): a violating
  sample, linted at a path where the rule must apply with the real root config, must report that
  rule id, and a compliant sample where the config exempts it must report nothing. A rule the
  canary proves cannot be switched off, narrowed to the wrong files or shadowed by a later
  override without `pnpm check` failing.
  - `yes`: a canary case proves it.
  - `tests`: only the rule's own `RuleTester` tests (`tools/oxlint-plugin/src/<rule>.test.ts`)
    prove this variant; the canary proves the rule fires at that path through another sample.
  - `uncovered`: the rule is on and listed in `UNCOVERED` with the reason no sample triggers it.
  - `no`: the rule comes from an oxlint category (`correctness`, `suspicious`), not from a named
    entry in `vite.config.ts`, and no case samples it.
  - `-`: not a lint rule (type check, Knip, jscpd, a test, review).

If you add a convention to a document, add its row here. If you add or re-scope a lint rule or a
boundary, add its canary case in the same change (`docs/testing.md`, "Recipe: a lint rule and its
canary case"); the canary fails when `vite.config.ts` names a rule that no case proves and
`UNCOVERED` does not excuse.

Rule ids: `repo/*` are this repo's rules (`tools/oxlint-plugin/src/<name>.ts`, registered in
`tools/oxlint-plugin/src/index.ts`, each with its `RuleTester` test next to it); the others are
oxlint's, configured in the root `vite.config.ts`. `type-check` stands for
`lint.options.typeCheck` (a TypeScript error) and `unused-disable-directive` for
`lint.options.reportUnusedDisableDirectives`.

## Errors, effects, environment

| Convention                                                                                                               | Documented in         | Enforced by                                                                                             | Canary |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| No `throw`, `try`/`catch`, promise `.catch()` outside `*.adapter.ts` (tests included)                                    | AGENTS.md, errors.md  | `repo/no-throw`                                                                                         | yes    |
| No rejection handler (`.then(ok, onRejected)`), `Promise.reject`, `reject` of `new Promise` or `Promise.withResolvers()` | errors.md             | `repo/no-throw`                                                                                         | tests  |
| Errors are tagged objects, never `Error` subclasses                                                                      | AGENTS.md, errors.md  | `repo/no-throw` (`class X extends *Error`)                                                              | tests  |
| An adapter and its own test (`*.adapter.test.ts`) may throw and reject                                                   | errors.md             | the override that turns `repo/no-throw` off for `**/*.adapter.ts` and `**/*.adapter.test.ts`            | yes    |
| Adapters wrap third-party code and nothing else                                                                          | errors.md             | `repo/boundaries` (an adapter imports no API module or web feature); what an adapter contains is review | yes    |
| Callers handle every error variant                                                                                       | errors.md             | `typescript/switch-exhaustiveness-check`                                                                | yes    |
| React effect hooks (`useEffect`, `useLayoutEffect`, `useInsertionEffect`, `useEffectEvent`) only in `*.effect.ts(x)`     | AGENTS.md, react.md   | `repo/no-effect` (named, namespace, default and destructured imports, re-exports)                       | yes    |
| An `*.effect.ts(x)` file exports only `useXxx` hooks (and types), uses an effect, and stays under 80 lines               | react.md              | `repo/effect-file`, `max-lines` 80 (the EFFECTS override)                                               | yes    |
| Effects list their dependencies and set no state synchronously                                                           | react.md              | `react/exhaustive-deps`, `react/set-state-in-effect`                                                    | yes    |
| `process.env` only in `apps/*/src/env.ts`, `e2e/src/env.ts`, `packages/db/src/test-env.ts` and tool configs              | AGENTS.md, backend.md | `repo/no-process-env`                                                                                   | yes    |

`repo/no-throw` has no type information (oxlint JS plugins get none), so it decides
syntactically, with scope analysis. A `.catch(...)` is Zod's, and allowed, when the receiver is
built from a `zod` import in the same file (directly or through `const`s) or the argument is a
plain value (`.catch("todo")`). It cannot see: a function argument to `.catch` on a Zod schema
imported from another package (reported; pass the fallback value or build from `z` in the file),
a rejection produced by a library (`AbortController.abort()`, an emitter's `error`), an
iterator's `.throw()`, and a helper an adapter exports that throws on behalf of its caller (by
design: adapters are the place for that). `.finally()` is allowed: it cannot swallow a rejection.

## React and the web app

| Convention                                                                                                     | Documented in       | Enforced by                                                                                                                                                             | Canary    |
| -------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| No `useMemo`, `useCallback`, `memo` (React Compiler)                                                           | AGENTS.md, react.md | `repo/no-manual-memo` (named, `React.useMemo` through a namespace or default import, destructuring, re-export)                                                          | yes       |
| Rules of hooks                                                                                                 | react.md            | `react/rules-of-hooks`, `react/hooks`                                                                                                                                   | yes       |
| Render is pure: no impure call, global write, ref read, setState or mutation during render                     | react.md            | `react/purity`, `react/globals`, `react/refs`, `react/set-state-in-render`, `react/immutability`                                                                        | yes       |
| Components are defined at module level                                                                         | react.md            | `react/static-components`                                                                                                                                               | yes       |
| Nothing makes the React Compiler bail out; no suppressions                                                     | react.md            | `react/todo`, `react/unsupported-syntax`, `react/error-boundaries`, `react/rule-suppression`, `react/use-memo`, `react/memo-dependencies`, `react/incompatible-library` | yes       |
| (compiler rules on, but no sample can trigger them)                                                            | react.md            | `react/preserve-manual-memoization`, `react/syntax`                                                                                                                     | uncovered |
| Design tokens only: no Tailwind palette, no hard-coded colour or length in a class name or inline style string | AGENTS.md, react.md | `repo/design-tokens` (`.ts`/`.tsx` under `apps/web` and `packages/ui`)                                                                                                  | yes       |
| No hard-coded colour or length in a `.css` file or a numeric inline style (`style={{ width: 13 }}`)            | react.md            | Guideline: oxlint does not read CSS, and the rule checks string values only. Raw values belong in `packages/ui/src/styles.css`, as tokens                               | -         |
| No `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` outside `features/*/api/` and `src/lib/`           | AGENTS.md, react.md | `no-restricted-globals`                                                                                                                                                 | yes       |
| Only `features/*/api/` and `src/lib/` import the oRPC client (`src/lib/orpc.ts`)                               | react.md            | `repo/boundaries` (zone with `except`)                                                                                                                                  | yes       |
| `model/` imports no npm package but `zod` (workspace packages such as `@app/contracts` are allowed)            | react.md            | `repo/boundaries` (externals)                                                                                                                                           | yes       |
| `model/` and the pure packages read no clock, random source or browser global                                  | AGENTS.md, react.md | `repo/pure-model` (`Date.now()`, `new Date()`, `Math.random()`, `crypto.*`, `performance.now()`, `newId()`, `window`, `document`, `localStorage`, ...)                  | yes       |
| A `.tsx` file exports components only (route files excepted)                                                   | react.md            | `react/only-export-components`                                                                                                                                          | yes       |
| File names are kebab-case (route files follow the router's syntax)                                             | react.md            | `unicorn/filename-case`                                                                                                                                                 | yes       |
| Accessibility: names on controls, labels tied to their control, no click handlers on non-interactive elements  | react.md            | the `jsx-a11y` plugin's correctness rules (the common misses); the rest is review and the e2e suite, which finds everything by role                                     | yes       |
| Icons from `lucide-react`                                                                                      | AGENTS.md, react.md | `repo/boundaries` externals in `packages/ui`; in `apps/web`, pnpm's strict `node_modules` (no other icon package is a dependency)                                       | yes       |
| Routes are thin                                                                                                | react.md            | Size only (see "Size"); what a route contains is review                                                                                                                 | yes       |
| Logic goes to `model/`, hooks or `api/`, never into components                                                 | AGENTS.md, react.md | Guideline: a lint rule cannot tell a decision from wiring; size limits catch the component that grows                                                                   | -         |
| One exported component per `.tsx`, named like the file; hooks `useXxx` in `hooks/use-xxx.ts`                   | react.md            | Guideline (cheap to add as a rule if it drifts)                                                                                                                         | -         |
| Derive, do not synchronise; state lives where the table in react.md says                                       | react.md            | Guideline (`repo/no-effect` removes the usual way to synchronise)                                                                                                       | -         |
| Forms: one validator in `model/`, built on the contract's schema; no native constraints                        | react.md            | Guideline                                                                                                                                                               | -         |

The accessibility row is proven for the plugin as a whole: the canary samples one of its rules
(`jsx-a11y/alt-text`) to show the plugin applies to web code. The icons row is proven for
`packages/ui` (its externals case).

## API and database

| Convention                                                                     | Documented in       | Enforced by                                                                                                   | Canary |
| ------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------- | ------ |
| Contract first: procedures, inputs, outputs and errors in `packages/contracts` | backend.md          | Type check: `apps/api/src/router.ts` does not compile until it implements the contract                        | -      |
| A service error reaches the client only as a declared contract error           | errors.md           | Type check: `respond` takes the procedure's `errors`, which offers only declared codes                        | -      |
| A web failure type names its procedures (`ApiFailure<"notes.create">`)         | errors.md, react.md | Type check: `ApiFailure` has no default argument                                                              | -      |
| Input schemas read no state                                                    | backend.md          | `repo/boundaries` (externals: `packages/contracts` imports only `zod`, `@orpc/contract`)                      | yes    |
| Import another API module only through its `index.ts`                          | backend.md          | `repo/boundaries` (modules)                                                                                   | yes    |
| Database failures as values (`tryQuery`); defects are not caught               | backend.md          | `repo/no-throw`                                                                                               | yes    |
| Time comes from the context (`now()`), not `new Date()` in a service or repo   | backend.md          | Guideline (`repo/pure-model` covers web `model/` and the pure packages, not `apps/api`)                       | -      |
| Repos take `db` first and only query                                           | backend.md          | Guideline                                                                                                     | -      |
| Never edit an applied migration                                                | backend.md          | Guideline (drizzle-kit regenerates from the schema, so an edited migration drifts from its snapshot silently) | -      |

## Architecture and dependencies

| Convention                                                                                                       | Documented in   | Enforced by                                                                                           | Canary |
| ---------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- | ------ |
| `apps/web` imports neither `apps/api` nor `packages/db`; packages import no app                                  | architecture.md | `repo/boundaries` (zones)                                                                             | yes    |
| Pure packages (`PURE_PACKAGES` in `vite.config.ts`: `result`, `contracts`): allowlisted npm only, no Node or DOM | architecture.md | `repo/boundaries` (externals), `"types": []` from `tsconfig.base.json` (`type-check`)                 | yes    |
| `packages/ui` imports only React, Base UI, lucide-react, tailwind-variants, and no other workspace package       | architecture.md | `repo/boundaries` (externals + zone)                                                                  | yes    |
| `src/lib` imports no feature or route; features import no route                                                  | architecture.md | `repo/boundaries` (zones)                                                                             | yes    |
| Another web feature only through its `index.ts`                                                                  | architecture.md | `repo/boundaries` (modules)                                                                           | yes    |
| No import cycles, no module importing itself                                                                     | architecture.md | `import/no-cycle`, `import/no-self-import`                                                            | yes    |
| A package imports only what it declares                                                                          | architecture.md | pnpm's strict `node_modules` + type check                                                             | -      |
| Versions only in the catalog: every dependency is `catalog:` or `workspace:*`                                    | AGENTS.md       | `tools/workspace-check` (a test in `pnpm check`); pnpm's `catalogMode: strict` covers `pnpm add` only | -      |
| No unused catalog entry                                                                                          | AGENTS.md       | Knip                                                                                                  | -      |

## Types and hygiene

| Convention                                                                               | Documented in       | Enforced by                                                                                                                       | Canary |
| ---------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| TypeScript errors fail the check                                                         | AGENTS.md           | `type-check` (`lint.options.typeCheck`)                                                                                           | yes    |
| No `any`; no unsafe use of `any`                                                         | AGENTS.md           | `typescript/no-explicit-any`, `typescript/no-unsafe-assignment`, `-argument`, `-call`, `-member-access`, `-return`                | yes    |
| No `as` casts except `as const`; no `!`; no needless assertion                           | AGENTS.md           | `typescript/consistent-type-assertions` (`never`), `typescript/no-non-null-assertion`, `typescript/no-unnecessary-type-assertion` | yes    |
| No floating or misused promises; no `await` of a non-promise                             | AGENTS.md           | `typescript/no-floating-promises`, `typescript/no-misused-promises`, `typescript/await-thenable`                                  | yes    |
| No needless condition; safe template literals; type-only imports marked                  | AGENTS.md           | `typescript/no-unnecessary-condition`, `typescript/restrict-template-expressions`, `typescript/consistent-type-imports`           | yes    |
| `@ts-expect-error` / `@ts-ignore` only with a description; no `@ts-nocheck`              | AGENTS.md           | `typescript/ban-ts-comment`                                                                                                       | yes    |
| No disable comment that disables nothing                                                 | AGENTS.md           | `unused-disable-directive` (`reportUnusedDisableDirectives: "error"`)                                                             | yes    |
| No `console.log` / `debug` / `trace` / `dir` / `table` (`info`, `warn`, `error` allowed) | AGENTS.md           | `no-restricted-properties`                                                                                                        | yes    |
| Named exports only (route files and tool configs excepted)                               | AGENTS.md, react.md | `import/no-default-export`, the DEFAULT_EXPORT_ALLOWED override                                                                   | yes    |
| One import statement per module; no side-effect import but a stylesheet                  | AGENTS.md           | `import/no-duplicates`, `import/no-unassigned-import`                                                                             | yes    |
| Tool and test imports from `vite-plus`, not `vite` or `vitest`                           | testing.md          | `vite-plus/prefer-vite-plus-imports`                                                                                              | yes    |
| oxlint's `correctness` and `suspicious` categories and the `oxc` plugin are on           | AGENTS.md           | `categories` in `lint` (the canary samples `no-debugger`, `no-useless-concat`, `oxc/erasing-op`)                                  | yes    |
| No unused files, exports, dependencies, catalog entries                                  | AGENTS.md           | Knip (`knip.config.ts`), see "Dead code"                                                                                          | -      |
| No copy-paste of 80 tokens or more (about 15 lines)                                      | AGENTS.md           | jscpd (`.jscpd.json`), see "Duplication"                                                                                          | -      |
| Formatting                                                                               | AGENTS.md           | oxfmt (`fmt` in `vite.config.ts`) in `vp check`; the editor hook and the pre-commit hook apply it                                 | -      |
| Never weaken a rule or add a disable comment to get green                                | AGENTS.md           | Guideline (review); `react/rule-suppression` for the compiler rules; the canary for a weakened config                             | -      |

## Size

| Limit (blank lines and comments not counted)                                                                | Enforced by                                                  | Canary |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------ |
| Anywhere not listed below: 400 lines a file, 200 a function, complexity 45                                  | `max-lines`, `max-lines-per-function`, `complexity` (`SIZE`) | yes    |
| Nesting depth 4, everywhere                                                                                 | `max-depth`                                                  | yes    |
| `apps/web/src` and `packages/ui/src`: 250 lines a file, 120 a function, complexity 25                       | the same rules, `WEB_SIZE` override                          | yes    |
| `apps/api/src`, `packages/*/src` except `ui`, `tools/*/src`: 300 lines a file, 65 a function, complexity 15 | the same rules, `BACKEND_SIZE` override                      | yes    |
| Tests and test-only code (`TEST_CODE`): 700 lines a file, 300 a function, complexity 30                     | the same rules, `TEST_SIZE` override                         | yes    |
| Route files (`apps/web/src/routes`): 150 lines a file, 40 a function, complexity 5; effect files: 80 lines  | the same rules, per-folder overrides                         | yes    |

The canary probes each limit at its edge (a file exactly at the limit passes, one line more
fails), so changing a number in `vite.config.ts` fails it until the case changes too. The
ceilings were set just above the largest file and function of the codebase this template was cut
from, once the outliers were split. They are generous for a new project: lower them when your own
code settles, never raise them to let one file through. Past a limit, split by responsibility: a
component into smaller components and a hook, a service function into named steps, a long test
file by behaviour.

## Tests

| Convention                                                                                    | Documented in | Enforced by                                                                                                | Canary |
| --------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| No `.only`, `.skip` (Vitest); no duplicate test titles; every test asserts                    | testing.md    | `vitest/no-focused-tests`, `vitest/no-disabled-tests`, `vitest/no-identical-title`, `vitest/expect-expect` | yes    |
| No `.todo` (Vitest)                                                                           | testing.md    | `vitest/warn-todo` (correctness category)                                                                  | no     |
| No assertion under a condition (Vitest)                                                       | testing.md    | `vitest/no-conditional-expect` (correctness category)                                                      | no     |
| Mock functions are typed (`vi.fn<() => Response>()`)                                          | testing.md    | `vitest/require-mock-type-parameters` (correctness category)                                               | no     |
| No early `return` under a condition in a test (it passes without its assertions)              | testing.md    | `repo/test-hygiene`; narrow with `assert(x !== undefined)` instead                                         | yes    |
| No snapshots                                                                                  | testing.md    | `vitest/no-restricted-matchers` (every snapshot matcher)                                                   | yes    |
| No `.concurrent` (one database per worker)                                                    | testing.md    | `no-restricted-properties` (`it`/`test`/`describe.concurrent`)                                             | yes    |
| Find by role and label, never by test id (Vitest and Playwright)                              | testing.md    | `no-restricted-properties` (`*ByTestId`)                                                                   | yes    |
| Playwright: no `.only`, `.skip`, `.fixme`; every test asserts; no assertion under a condition | testing.md    | `repo/test-hygiene` (`playwright: true` on `e2e/tests`), and Playwright's `forbidOnly` at run time         | yes    |
| Test files follow the source rules (no `throw`, `any`, casts)                                 | testing.md    | the same rules apply; only `*.adapter.test.ts` may throw                                                   | yes    |
| No class-name assertions; assert behaviour, not markup                                        | testing.md    | Guideline                                                                                                  | -      |
| Call `createTestDb()` (or `createTestApp()`) in each test; `isolate: false` in api and db     | testing.md    | Guideline (a test that skips it sees the previous test's rows and usually fails)                           | -      |

`vitest/no-conditional-in-test` was tried and left off: it reports every `??`, `&&` and ternary
in a test body, nearly all harmless; the early-return and conditional-expect checks cover the
cases that make a test pass vacuously.

## Dead code

`knip.config.ts`; the `knip` task runs Knip twice. `knip` reports unused files, dependencies,
catalog entries and exports, counting tests as users, plus unused exports of the entry file of
every package in `packages/` (`includeEntryExports`; their exported types are kept as API). So
export from `packages/contracts/src/index.ts` (or any package entry) only what another package
imports. `knip --production` drops tests, test helpers and fixtures, so it reports exports and
files only tests use; an export kept for test code is tagged `/** @internal ... */` (as
`createTestDb` in `packages/db/src/testing.ts`). Knip names the export or dependency and its
file and line; the fix is to delete it (or, for an export, to stop exporting it).

A new workspace under `tools/` gets an entry in `knip.config.ts` `workspaces` (copy
`tools/rename-scope`'s); `apps/*` and `packages/*` are covered.

The consequence for a template: nothing is kept "for later". A helper the skeleton does not call
is deleted, and its pattern lives in a recipe instead (`unexpected()`, `inTransaction`, form
primitives). When you add the first caller, add the helper with it.

## Duplication

`pnpm duplicates` (in `pnpm check`): jscpd over `apps`, `packages`, `tools` and `e2e/src`, tests
and test helpers excluded (`.jscpd.json`), at 80 tokens (about 15 lines). It fails on any clone
(`--exit-code 1`) and prints both locations; there is no baseline of tolerated ones. Move the
shared code into one function both callers import (inside a module or feature, or a package when
two apps need it). Below 80 tokens it reports mostly short JSX and `if` chains that are not worth
sharing. It does not see near-duplicates written differently (the same rule restated by hand, the
same sentence worded twice); that is review.
