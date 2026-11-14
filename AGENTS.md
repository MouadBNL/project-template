# AGENTS.md

A project template: a TypeScript monorepo (API, web app, shared packages) with no product in it
yet, built to be worked on by AI agents. Conventions are enforced by tools, not by this file. When
a check fails, read the message: it tells you the fix. This file says where things go; the docs
say how to add the next thing, step by step.

## Commands

Run from the repo root. Toolchain is Vite+ (`vp`), package manager pnpm 12, Node 26 (pinned in
`.node-version` and `package.json#packageManager`).

| Command                                  | What it does                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| `vp install`                             | Install dependencies and the pre-commit hook. Run after pulling.                        |
| `pnpm dev`                               | API on `API_PORT` (3001) + web on `WEB_PORT` (5173); the web dev server proxies `/rpc`  |
| `pnpm -C packages/db generate`           | New SQL migration from `packages/db/src/schema` changes. Commit it.                     |
| `pnpm check`                             | Everything: format, lint, types, boundaries, tests, canary, Knip, duplicates. Cached.   |
| `pnpm fix`                               | Apply formatting and safe lint fixes (`vp check --fix`).                                |
| `vp check`                               | Format + lint + types for the current directory only. Fastest inner loop.               |
| `vp -C apps/api test`                    | Tests of one package.                                                                   |
| `vp -C apps/api test src/modules/system` | Tests matching a path. Add `-t "name"` to filter by test name.                          |
| `vp run --filter @app/web check:static`  | One task in one package, through the cache.                                             |
| `vp -C apps/web run routes`              | Regenerate `apps/web/src/routeTree.gen.ts` after adding or renaming a route.            |
| `node tools/canary/src/main.ts`          | The canary alone: does the root config still fire every rule it claims (about 2.5 s)    |
| `pnpm e2e`                               | Browser journeys (Playwright) on the real API + a production build. Not in `pnpm check` |
| `pnpm test:postgres`                     | API, db and e2e suites on a throwaway Postgres container (Docker). Opt-in               |

`pnpm check` must pass before you finish. Never weaken a rule or add a disable comment to get
green; fix the code. `vp check` is a built-in command; `vp run check` / `pnpm check` is the script.

### Fastest loop for what you changed

| You changed                         | Run while working                                                 | Then                               |
| ----------------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| one file                            | `vp check <file>` and `vp -C <pkg> test <file>`                   | `pnpm check` (cached: seconds)     |
| one package                         | `vp -C <pkg> check` and `vp -C <pkg> test`                        | `pnpm check`                       |
| a contract (`packages/contracts`)   | `vp -C apps/api check`, `vp -C apps/web check`                    | `pnpm check` (reruns both)         |
| a schema (`packages/db/src/schema`) | `pnpm -C packages/db generate`, `vp -C apps/api test`             | `pnpm check`, `pnpm test:postgres` |
| a screen or a user flow             | `vp -C apps/web test`                                             | `pnpm check`, `pnpm e2e`           |
| a lint rule or `vite.config.ts`     | `vp -C tools/oxlint-plugin test`, `node tools/canary/src/main.ts` | `pnpm check`                       |
| a `package.json` dependency         | `vp install`, `vp -C tools/workspace-check test`                  | `pnpm check`                       |
| a doc (`*.md`)                      | `vp fmt --check <file>` (`vp check` lints only code files)        | `pnpm check`                       |

`pnpm check` caches per package and task: after a one-file change only the affected tasks rerun
(timings: `docs/testing.md`, "Speed of the check loop").

### Hooks and CI

- A pre-commit hook (`.vite-hooks/pre-commit`, installed by `vp install` through `vp config`)
  runs `vp staged`: `vp check --fix` on the staged files only, a few seconds. Do not bypass it.
- `.claude/settings.json` (Claude Code) allows the commands above without a prompt (`pnpm check`,
  `pnpm fix`, `pnpm e2e`, `vp check`, `vp test`, `vp -C <pkg> test|check`) and formats every file
  an agent edits or writes (`.claude/hooks/format-edited-file.sh`, `vp fmt`, under a second).
- CI (`.github/workflows/ci.yml`) runs `pnpm check` and `pnpm e2e` on pushes to `main` and on
  pull requests.

## Map

```
apps/api               Hono + oRPC server. src/modules/<name>/ holds features (index.ts = public
                       API). One module today: system (the health check)
apps/web               React 19 SPA. src/routes (thin file routes), src/features/<name>/
                       (components, hooks, model, api; index.ts = public API), src/lib (oRPC
                       client, failure types, adapters), src/testing (component test helpers)
packages/ui            Design system: tokens (src/styles.css) + primitives on Base UI. No logic, no data
packages/result        Result type: ok(), err(), fromThrowable(), fromPromise()
packages/contracts     Zod schemas + the oRPC contract (`contract`, `ApiClient`), shared errors
packages/db            createDb() (Postgres or PGlite), tryQuery, migrations, test DBs
                       (@app/db/testing). No tables yet: src/schema/ is where the first one goes
e2e                    Playwright journeys (`pnpm e2e`) and `pnpm test:postgres`; src/ starts the stack
tools/oxlint-plugin    Repo lint rules: repo/no-throw, no-effect, effect-file, no-manual-memo,
                       pure-model, test-hygiene, no-process-env, boundaries, design-tokens
tools/canary           Proves the root lint config still fires each rule it claims (docs/testing.md)
tools/rename-scope     `node tools/rename-scope/src/main.ts <name>`: renames the @app/* scope
tools/workspace-check  Fails on a dependency version written outside the catalog
vite.config.ts         Root config: fmt, lint rules, boundaries, size limits, task cache, staged
knip.config.ts         Dead code: unused files, exports, dependencies (docs/conventions.md)
pnpm-workspace.yaml    Workspaces + the catalog (every dependency version, declared once)
tsconfig.base.json     Strict compiler options every package extends
```

Internal packages export their TypeScript source (`"exports": { ".": "./src/index.ts" }`). There
is no build step for them; import relative files with explicit `.ts` extensions.

## Starting a project, and the first feature

`README.md`, "Start a new project", has the steps: `vp install`, then
`node tools/rename-scope/src/main.ts <name>`, then `vp install` again, then `pnpm check` and
`pnpm e2e`. Then add the first thing through its recipe:

| The first...                | Goes in                                           | Recipe                                                            |
| --------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| table                       | `packages/db/src/schema/<name>.ts`                | `docs/architecture.md`, "Recipe: a table and its first migration" |
| API procedure               | `packages/contracts/src/<name>.ts`, then a module | `docs/architecture.md`, "Recipe: an API module"                   |
| expected error              | the procedure's `.errors({...})`                  | `docs/errors.md`, "Recipe: a contract error"                      |
| error every service returns | `apps/api/src/errors.ts`, `orpc/procedures.ts`    | `docs/errors.md`, "Recipe: a shared error"                        |
| screen                      | `apps/web/src/features/<name>/` and a route       | `docs/architecture.md`, "Recipe: a web feature"                   |
| UI primitive                | `packages/ui/src/<name>.tsx`                      | `docs/architecture.md`, "Recipe: a UI primitive"                  |
| shared package / tool       | `packages/<name>/` or `tools/<name>/`             | `docs/architecture.md`, "Recipe: a package"                       |
| lint rule or boundary       | `tools/oxlint-plugin/src/`, root `vite.config.ts` | `docs/testing.md`, "Recipe: a lint rule and its canary case"      |

`modules/system` (API) and `features/system` (web) are the worked example of a read through every
layer: contract, procedure, `Result` mapped to a declared error, typed client, failure worded in
`model/`, query, screen, tests and an e2e journey. The recipes add what a write needs (a table, a
repo, a form).

**Not in the template**, by design (product decisions, each a recipe consistent with the rules):
authentication (`docs/backend.md`, "Recipe: authentication"), permissions ("Recipe:
permissions", and `docs/react.md`, "Recipe: gating controls by permission"), live updates
(`docs/backend.md`, "Recipe: live updates"), a local data layer with optimistic writes
(`docs/react.md`), transactions (`docs/backend.md`, "Transactions and locking"), branded IDs and
`newId()` (`docs/architecture.md`, table recipe), form primitives and other UI primitives
(dialog, menu, input: `docs/architecture.md`, "Recipe: a UI primitive"). Do not look for them in
the tree.

## Hard rules

Enforced by `pnpm check` except the parts `docs/conventions.md` marks as guidelines (it lists every
convention with the rule that checks it).

- **Errors are values.** Return `Result` from `@app/result`: `const r = await f(); if (!r.ok) return r;`.
  Errors are tagged objects (`{ type: "not_found" }`), never `Error` subclasses. `throw`,
  `try`/`catch` and `.catch()` are only allowed in `*.adapter.ts` files. See `docs/errors.md`.
- **Contract first.** New API procedures start in `packages/contracts`, including their expected
  errors (`.errors({...})`). The API implements the contract; the web is typed from it, errors
  included (`ApiFailure<"module.procedure">`, `failureOf`). `apps/web` never imports `apps/api`
  or `packages/db`.
- **Effects are quarantined.** `useEffect` / `useLayoutEffect` / `useInsertionEffect` /
  `useEffectEvent` only in `*.effect.ts(x)` files, as small named hooks (the file exports only
  `useXxx` hooks) that sync with an external system. Prefer derived state, event handlers, Query.
- **React.** Read `docs/react.md` before writing a component. Logic goes to `model/` (pure), hooks
  or `api/` (data access), never into components; no `fetch` outside `api/` and `src/lib`; no
  `useMemo`/`useCallback`/`memo` (React Compiler); styles use design tokens only (no Tailwind
  palette, no hard-coded colours or lengths); icons from `lucide-react`.
- **Env in one place.** `process.env` is read only in `apps/<app>/src/env.ts` (Zod-validated).
- **Boundaries.** Packages never import apps. `result` and `contracts` stay pure (no Node
  built-ins, no React, no IO; `PURE_PACKAGES` in `vite.config.ts`). In `apps/api`, import another
  module only via its `index.ts`; in `apps/web`, another feature only via its `index.ts`.
  `packages/ui` imports only React, Base UI, lucide-react, tailwind-variants. No import cycles.
  See `docs/architecture.md`.
- **Types.** No `any`, no `as` casts (except `as const`), no `!`, no floating promises, exhaustive
  switches, `@ts-expect-error` only with a description.
- **Hygiene.** No `console.log`, no `.only` / `.skip`, no default exports (except route files and
  tool configs), no unused files, exports or dependencies (Knip), no new copy-paste (jscpd), no
  file or function past the size limits.
- **Dependencies.** Versions live only in `pnpm-workspace.yaml#catalog`; every `package.json`
  dependency is `"catalog:"` or `"workspace:*"` (`tools/workspace-check` fails on anything else;
  pnpm itself only checks `pnpm add`). Then `vp install`.
- **Guardrails are proven.** A new lint rule or boundary gets a canary case that violates it and a
  row in `docs/conventions.md` (`docs/testing.md`, "Recipe: a lint rule and its canary case").

## Docs

- `docs/conventions.md`: every convention, where it is documented, the tool and rule that
  enforces it (or why it is a guideline), and whether the canary proves it. Start here when a
  check fails.
- `docs/architecture.md`: layout, dependency rules, and the recipes: a table and its first
  migration, an API module, a web feature, a UI primitive, a package.
- `docs/errors.md`: errors as values, adapters, how a service error becomes a declared contract
  error and reaches the client typed; recipes for a contract error and a shared error.
- `docs/backend.md`: API request path, module layout, context, `respond`, env, the database and
  repos, writing an API test; patterns (not in the template) for transactions, authentication,
  permissions and live updates.
- `docs/react.md`: where code goes, state, effects, React Compiler, data loading, forms, client
  errors, the design system, accessibility; recipes (not in the template) for a local data layer
  and permission-gated controls.
- `docs/testing.md`: where tests live, kinds of tests, the canary and the lint-rule recipe, real
  Postgres, the e2e suite, frontend tests, timings of the check loop.
- Vite+ docs: `node_modules/vite-plus/docs` (after `vp install`) or https://viteplus.dev/guide/.
