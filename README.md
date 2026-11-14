# Project template

A starting point for a TypeScript product (an API, a web app, shared packages) that AI coding
agents will write most of. It holds no product: only the guardrails, and one health check wired
through every layer so each guardrail has something real to stand on.

It is for teams who want agents to produce code that stays clean, working and maintainable
without a human re-reading every line for the same mistakes. The rules are written down once and
checked by tools on every change; the docs say where things go and how to add the next thing.

## Principles

- **Conventions are enforced by tools.** Each convention in `docs/conventions.md` names the lint
  rule, boundary, type check or test that fails on a violation, or says it is a guideline and why.
  Error messages say how to fix the code.
- **The check loop is fast and cached.** `pnpm check` runs format, lint, types, boundaries, tests,
  dead-code and copy-paste detection, cached per package and task: about 26 s cold, a second when
  nothing changed, seconds after a small change.
- **Types flow from the contract to the UI.** API procedures, their inputs, outputs and expected
  errors are declared once in `packages/contracts`; the server implements them, the web is typed
  from them. A changed error breaks the client at compile time.
- **Errors are values.** Fallible code returns a `Result`; `throw` and `catch` live only in
  `*.adapter.ts` files that wrap third-party code.
- **Boundaries are checked.** Packages do not import apps, pure packages import no IO, features
  import each other only through their `index.ts`, effects live in their own files.
- **A canary proves the guardrails fire.** For each rule the docs claim, a violating sample is
  linted with the real root config and must be reported with that rule. A config edit that
  silently switched a rule off fails `pnpm check`.

## Stack

Vite+ (`vp`) monorepo with pnpm, TypeScript, oxlint and oxfmt, Knip, jscpd, Vitest, Playwright.
API: Node, Hono, oRPC, Drizzle on Postgres or PGlite (Postgres in WASM, no server needed). Web:
React 19 with the React Compiler, TanStack Router and Query, Tailwind v4, Base UI.

## Quick start

Needs [Vite+](https://viteplus.dev) (`vp`); it provides the pinned Node and pnpm. No database
server: the API runs on PGlite in `.data/pglite` unless `DATABASE_URL` is set. `pnpm e2e` needs
Playwright's Chromium (`pnpm -C e2e exec playwright install chromium` once).

```sh
vp install     # dependencies, and the pre-commit hook
pnpm check     # everything should pass on a fresh copy
pnpm dev       # web on http://localhost:5173 (shows the API's health), API on :3001
```

Settings such as ports and `DATABASE_URL` are in `.env.example`; copy it to `.env` to change them.

## Start a new project

1. Create the repository: "Use this template" on GitHub, or copy the files and start a fresh
   history (`git clone <url> my-app && cd my-app && rm -rf .git && git init`).
2. Install: `vp install`. The rename tool imports workspace packages, so it needs an installed
   tree.
3. Rename the package scope: `node tools/rename-scope/src/main.ts <name>` turns every `@app/*`
   into `@<name>/*` (package names, imports, config, docs) and the root package into `<name>`,
   and lists the files it changed.
4. Install again: `vp install` (relinks the workspace packages under their new names).
5. Run `pnpm check` and `pnpm e2e`. Both pass before you change anything; if not, the machine is
   missing something (Docker is only needed for `pnpm test:postgres`).
6. Edit this README and the first paragraph of `AGENTS.md` to say what the product is.
7. Add the first feature through its recipes, in this order: a table
   (`docs/architecture.md`, "Recipe: a table and its first migration"), an API module ("Recipe:
   an API module", with `docs/errors.md`, "Recipe: a contract error"), a web feature and its
   route ("Recipe: a web feature", and "Recipe: a UI primitive" for a missing control).
   `modules/system` and `features/system` show the whole path for a read; replace the index
   screen when the product has one.
8. Decide the product questions the template leaves open (below) before the code that needs them.

## The check loop

`pnpm check` runs these stages in order, each a Vite+ task per package, cached on its inputs:

| Stage          | Catches                                                                                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check:static` | Formatting (oxfmt), lint (oxlint with the repo plugin: errors, effects, boundaries, tokens), type errors                                                                                                                                                                                       |
| `test`         | Behaviour: unit, API procedures over HTTP on a real database, components, lint rules (Vitest); the canary (`tools/canary`: a rule the docs claim that the root config no longer applies); the catalog check (`tools/workspace-check`: a version written outside `pnpm-workspace.yaml#catalog`) |
| `knip`         | Unused files, exports, dependencies and catalog entries, also counting only what ships                                                                                                                                                                                                         |
| `duplicates`   | Copy-paste of about 15 lines or more (jscpd)                                                                                                                                                                                                                                                   |

Outside `pnpm check`: `pnpm e2e` (Playwright on a production build and the real API, also in CI)
and `pnpm test:postgres` (the suites on a throwaway Postgres container, for races that PGlite
cannot show). The pre-commit hook formats and lints staged files. `docs/testing.md` has timings.

## Deliberately not included

These are product decisions, not guardrails; a template that picked for you would be deleted on
day one or bent to fit. Each has a recipe consistent with the enforced conventions.

- **Authentication.** No users, sessions or sign-in. Recipe: `docs/backend.md`, "Recipe:
  authentication" (a procedure base that adds the user to the context).
- **Database tables.** `packages/db` has the client, `tryQuery`, migrations and test databases,
  but no schema. Recipe: `docs/architecture.md`, "Recipe: a table and its first migration".
- **Transactions.** No `inTransaction` helper until the first write needs one:
  `docs/backend.md`, "Transactions and locking".
- **Permissions.** No roles or policy. Recipe: `docs/backend.md`, "Recipe: permissions" (one
  pure `can()` shared by API and web), and `docs/react.md`, "Recipe: gating controls by
  permission".
- **IDs.** No ID package, no branded ID types, no `newId()`; the table recipe says when to add
  them.
- **A local data layer.** The web reads the API through TanStack Query only. Recipe:
  `docs/react.md`, "Recipe: local data with optimistic writes".
- **Live updates.** No server push. Recipe: `docs/backend.md`, "Recipe: live updates".
- **Forms and most UI primitives.** `packages/ui` has `Button`, `RadioGroup`, `RadioCard` and
  `Skeleton`; no input, field, dialog, menu or toast. Pattern: `docs/react.md`, "Forms"; recipe:
  `docs/architecture.md`, "Recipe: a UI primitive".
- **Deployment.** No Dockerfile or hosting config; the API is a Node process
  (`pnpm -C apps/api start`) and the web a static build (`pnpm -C apps/web build`, into
  `apps/web/dist`).

## Read next

- [AGENTS.md](./AGENTS.md): commands, the fastest loop for each kind of change, the rules, which
  recipe to follow for the first thing of each kind.
- [docs/](./docs): conventions, architecture and recipes, errors, backend, React, testing.
