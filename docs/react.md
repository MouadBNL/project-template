# React guidelines

Read this before writing a component, a hook or a route in `apps/web` or `packages/ui`. The goal is
React that any agent can predict from the file name alone, and a UI that feels instant. Rules
marked **[check]** are enforced: `vp check` fails with a message that tells you the fix. The rest is
review discipline; follow it anyway. Sections marked **not in the template** describe patterns to
add when the product needs them. The step-by-step recipe for a feature is in
`docs/architecture.md`, "Recipe: a web feature".

## Where code goes

```
apps/web/src/
  main.tsx              applies the theme, creates the QueryClient and router, renders
  router.tsx            createRouter: preloading, pending timings, providers
  routes/               file routes: compose features, declare guards and loaders, nothing else
  features/<name>/
    index.ts            the feature's public API; other features and routes import only this
    components/         rendering and wiring: props in, JSX out, events to hooks
    hooks/              stateful logic (useActionState, useSyncExternalStore, router/query wiring)
    model/              pure logic: plain functions over plain data, tested without a DOM
    api/                data access: query options, oRPC calls, localStorage
  lib/                  cross-feature plumbing: oRPC client (orpc.ts), failure types
                        (api-failure.ts), QueryClient, providers, adapters
  testing/              test helpers: renderWithApp, rpcOutput / rpcError
packages/ui/src/        the design system: tokens (styles.css) and primitives on Base UI
```

Two features exist: `features/system` (the API's health on the index route: `api/`, `model/`,
`components/` and their tests) and `features/theme` (the light, dark or system preference, an
external store read with `useSyncExternalStore` in `hooks/use-theme-preference.ts`). Copy
`features/system` for the first real one.

| Rule                                                                       | Enforced by                                                     |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Import another feature only through its `index.ts`                         | **[check]** `repo/boundaries` (modules)                         |
| Only `features/*/api/` and `lib/` import `lib/orpc.ts`                     | **[check]** `repo/boundaries` (zone with `except`)              |
| No `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` outside those  | **[check]** `no-restricted-globals`                             |
| `model/` imports no npm package but `zod` (no React, no router, no IO)     | **[check]** `repo/boundaries` (externals)                       |
| `model/` reads no clock, random source or browser global                   | **[check]** `repo/pure-model`                                   |
| `lib/` imports no feature and no route; features import no route           | **[check]** `repo/boundaries` (zones)                           |
| `packages/ui` imports only React, Base UI, lucide-react, tailwind-variants | **[check]** `repo/boundaries` (externals + zone)                |
| Effect hooks only in `*.effect.ts(x)`, which export only `useXxx` hooks    | **[check]** `repo/no-effect`, `repo/effect-file`                |
| No `useMemo` / `useCallback` / `memo`, however imported                    | **[check]** `repo/no-manual-memo`                               |
| Styling with design tokens only                                            | **[check]** `repo/design-tokens`                                |
| Rules of hooks, React Compiler rules                                       | **[check]** `react/rules-of-hooks`, `react/purity`, ... (below) |
| A `.tsx` file exports components only (except route files)                 | **[check]** `react/only-export-components`                      |
| No `throw` / `try` / `.catch()` outside `*.adapter.ts`                     | **[check]** `repo/no-throw`                                     |
| Route files, components and hooks stay small                               | **[check]** `max-lines`, `max-lines-per-function`, `complexity` |
| File names are kebab-case (route files excepted)                           | **[check]** `unicorn/filename-case`                             |

`model/` may import workspace packages (`@app/contracts` for an input schema, `@app/result`) and
types from `lib/` (`ApiFailure`); the externals rule counts npm packages only. Everything else on
this page is a guideline; `docs/conventions.md` lists each one.

### Routes are thin

A route file wires a URL to features: guard (`beforeLoad`), data (`loader`), search params
(`validateSearch`) and which feature component renders. Decisions live in `model/`, UI in
`components/`. **[check]** only by size: a route file has at most 150 lines, a function in it 40,
complexity 5.

```tsx
// Good: the route starts the data and composes the feature's components.
export const Route = createFileRoute("/notes")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(notesQuery);
  },
  component: () => (
    <main className="mx-auto flex max-w-xl flex-col gap-8 p-8">
      <NewNoteForm />
      <NoteList />
    </main>
  ),
});

// Bad: a decision inline in the route, untestable without a router.
beforeLoad: ({ location }) => {
  const target = location.href.startsWith("//") ? "/" : location.href; // half-fixed open redirect
  ...
```

After adding or renaming a route run `vp -C apps/web run routes` (the dev server and
`check:static` do it too) and commit `src/routeTree.gen.ts`.

### Naming

- Files are `kebab-case` (**[check]** `unicorn/filename-case`): `system-status.tsx`,
  `use-theme-preference.ts`, `use-window-size.effect.ts`.
- One exported component per `.tsx`, named like the file (`SystemStatus` in `system-status.tsx`).
- Hooks are `useXxx` in `hooks/use-xxx.ts`; an effect hook's file ends in `.effect.ts`.
- Tests sit next to the code: `theme.test.ts`, `system-status.test.tsx`.
- Named exports only (**[check]** `import/no-default-export`; route files are the exception).

## What a component is for

A component renders props and wires events. Anything else moves out:

| It is...                                          | It goes in    | Example                                         |
| ------------------------------------------------- | ------------- | ----------------------------------------------- |
| a calculation, a validation, a decision, a format | `model/`      | `parseThemePreference`, `describeHealthFailure` |
| state that outlives a render, or React wiring     | `hooks/`      | `useThemePreference`, a form's action           |
| a request, storage, anything that leaves the page | `api/`        | `healthQuery`, `theme-preference.ts`            |
| markup and event wiring                           | `components/` | `SystemStatus`                                  |

```tsx
// Good: the component only renders; the hook owns the action, model/ the validation.
export function NewNoteForm() {
  const [state, formAction, pending] = useCreateNote();
  return (
    <form action={formAction}>
      ...
      <Button type="submit" variant="primary" pending={pending}>
        {pending ? "Saving…" : "Save note"}
      </Button>
    </form>
  );
}

// Bad: validation, the network call and navigation inside the component.
function NewNoteForm() {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (title.trim() === "") return setError("Required");
    const res = await fetch("/rpc/notes/create", { ... }); // fails no-restricted-globals
    ...
```

Why: `model/` is tested as plain functions in milliseconds; hooks are reused; components stay
short enough to read at a glance.

## State

### Derive, do not synchronise

If a value can be computed from props, state or the cache, compute it during render. Never copy
it into state and keep the copy updated with an effect.

```tsx
// Good: derived from the current preference.
const [current, setPreference] = useThemePreference();
const others = THEME_PREFERENCES.filter((preference) => preference !== current);

// Bad: a second source of truth that lags one render behind and can drift.
const [others, setOthers] = useState<ThemePreference[]>([]);
useEffect(() => setOthers(build(current)), [current]); // also fails repo/no-effect
```

### Where each kind of state lives

| State                                  | Home                                                | Example                                    |
| -------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| What the user is looking at, shareable | The URL: path params, `validateSearch` params       | a filter, a selected tab                   |
| Server data                            | TanStack Query cache                                | `healthQuery`                              |
| Facts every route below needs          | Router context, set in `beforeLoad`                 | the session, once there is one             |
| A value owned outside React            | `useSyncExternalStore` over a small store in `api/` | theme preference (localStorage + `<html>`) |
| A form being filled                    | The DOM (uncontrolled inputs) + `useActionState`    | any form                                   |
| Ephemeral UI (open, hovered, selected) | `useState` in the lowest component that needs it    | a menu's open state                        |

- **Colocate first.** Put state in the component that uses it. Lift it to the closest common parent
  only when a sibling needs it; if many distant components need it, it is URL, cache or context
  state, not lifted `useState`.
- **Reset with a key, not an effect.** To start a subtree fresh when an identity changes, give it a
  key: `<Editor key={thing.id} thing={thing} />`. Do not watch the id in an effect and reset
  fields by hand.
- **Uncontrolled by default** for form fields; control an input only when something must react to
  each keystroke (a filter box). Base UI components accept both.

## Effects

An effect runs after render, out of band. It makes a component's behaviour depend on timing
(double renders in Strict Mode, races between effects, an extra render to "catch up"), and it hides
data flow: a reader must simulate the effect to know what is on screen. Agents reach for effects
by habit, for things that have a better tool. So effects are quarantined: **[check]**
`repo/no-effect` allows `useEffect`, `useLayoutEffect`, `useInsertionEffect` and `useEffectEvent`
(which exists only to be called from an effect) only in `*.effect.ts(x)` files, and **[check]**
`repo/effect-file` keeps those files to small named hooks: they export only `useXxx` hooks and
types, use an effect, and stay under 80 lines. `useImperativeHandle` is not quarantined: it
exposes a ref's API and synchronises with nothing outside React.

The only legitimate use is **synchronising with an external system**: something that is not React
and not data you can fetch. Subscribing to the keyboard, a WebSocket, a third-party widget, the
document title, a `ResizeObserver` you cannot replace with CSS. Put it in
`features/<name>/hooks/use-<what>.effect.ts`, one hook per file, and call it from a component.
The template has none yet.

Before writing one, check this table:

| You want to...                                     | Do this instead                                           |
| -------------------------------------------------- | --------------------------------------------------------- |
| compute a value from props/state                   | compute it during render                                  |
| react to a click, a submit, a keypress in a field  | do it in the event handler (or the form action)           |
| fetch data when a page opens                       | a route `loader` + TanStack Query (`api/` query options)  |
| fetch data when an input changes                   | `useQuery` with the input in the key                      |
| redirect when signed out                           | the route's `beforeLoad`                                  |
| read a browser/global store (storage, media query) | `useSyncExternalStore` (see `use-theme-preference.ts`)    |
| reset state when a prop changes                    | a `key` on the component                                  |
| notify a parent of a change                        | call the parent's callback in the same handler            |
| run something once at startup                      | module scope or `main.tsx` (see `applyThemePreference()`) |

`react/set-state-in-effect` **[check]** also rejects the classic "set state in an effect" pattern
inside the files where effects are allowed.

## React Compiler

The React Compiler (babel preset in `apps/web/vite.config.ts`) memoizes every component and hook.
Consequences:

- **No `useMemo`, `useCallback` or `memo`** **[check]** `repo/no-manual-memo` (also through
  `React.useMemo` and destructuring). Write the plain expression or inline function; the
  compiler caches it with exact dependencies. Inline `onClick={() => ...}` and `[...a, ...b]` in
  render are fine. Manual memoization is noise that goes stale: a missing dependency is a bug the
  compiler would not have made.
- **Render must be pure** **[check]** `react/purity`, `react/globals`: no `Math.random()`,
  `Date.now()`, reading/writing module variables or `ref.current` during render (`react/refs`).
  Do it in an event handler, or in a value passed in.
- **Never mutate props, state or values from hooks** **[check]** `react/immutability`:
  `items.push(x)` on state breaks memoization; create new values (`[...items, x]`).
- **Components are defined at module level** **[check]** `react/static-components`; never create a
  component inside another one's render.
- **No suppressions** **[check]** `react/rule-suppression`; if the compiler bails out
  (`react/todo`, `react/unsupported-syntax`), restructure the code.
- A third-party hook that returns unstable or mutable values is reported by
  `react/incompatible-library` **[check]**; wrap it rather than memoizing around it.

## Data and speed

The app should feel instant: content is usually there when the click lands, and when it is not,
the layout does not jump.

- **No requests in components.** Components get data from hooks reading the Query cache; the
  request itself is in `features/<name>/api/` **[check]** (zone + `no-restricted-globals`).
- **Loaders start the work, components read the cache.** A route loader calls the feature's query
  options; the component reads the same options with `useQuery`/`useSuspenseQuery`.

  ```ts
  // Start the request, do not block the navigation (the index route does this for health):
  loader: ({ context }) => { void context.queryClient.prefetchQuery(healthQuery); },
  // For data the page cannot render without, block instead:
  loader: ({ context }) => context.queryClient.ensureQueryData(thingQuery(id)),
  ```

- **Preload on intent.** `defaultPreload: "intent"` (`router.tsx`) runs a route's `beforeLoad`,
  loader and code chunk when the pointer rests on a `<Link>` or focus reaches it. Use `<Link>` for
  navigation (never `onClick={() => navigate(...)}` on a div) so preloading works.
- **The router does not cache on top of Query** (`defaultPreloadStaleTime: 0`); Query owns
  freshness. The default `staleTime` (30 s) is set in `lib/query-client.ts`, so moving between
  pages reads the cache.
- **Skeletons, not spinners.** When something is genuinely loading, show `<Skeleton>` shaped like
  the content (`SystemStatus` does). Route pending UI appears only after a delay
  (`defaultPendingMs`, 500 ms) and then stays a minimum time (`defaultPendingMinMs`), so fast
  navigations never flash.
- **A loading state is acceptable** only for data that cannot be preloaded (first visit, search
  results as you type) and never for a whole screen that a loader could have fetched.
- **Writes**: a form action (`useActionState`, see "Forms") or `useMutation` in a hook, calling a
  function from the feature's `api/` that returns a `Result`, then
  `queryClient.invalidateQueries({ queryKey })` (or `setQueryData` with what the server returned).
  For writes that must apply in the same frame and roll back on failure, see "Recipe: local data
  with optimistic writes".
- Submit buttons show progress with `Button`'s `pending` (disabled, still focusable, `aria-busy`)
  and a present-tense label ("Saving…").

## Forms

The template has no form yet and no form primitives in `packages/ui` (no `Form`, `Field`,
`Input`); add the controls you need with `docs/architecture.md`, "Recipe: a UI primitive". The
pattern, whatever the primitives:

```tsx
// model/notes.ts: one validator, on the contract's own schema; the messages are worded here.
export function validateNewNote(fields: NoteFields): Result<NoteFields, Invalid> {
  const parsed = NewNote.safeParse(fields); // NewNote from @app/contracts
  if (parsed.success) return ok(parsed.data);
  ...map each issue to a sentence per field ("Enter a title.")
}

// hooks/use-create-note.ts: the action validates, calls api/, and returns the next form state.
return useActionState(async (_previous: NewNoteState, data: FormData) => {
  const values = { title: text(data, "title"), body: text(data, "body") };
  const input = validateNewNote(values);
  if (!input.ok) return { values, errors: input.error.fields, formError: null };
  const created = await createNote(input.value); // api/notes.ts, returns a Result
  if (!created.ok) return afterCreateFailure(values, created.error); // model/: field or form error
  await queryClient.invalidateQueries({ queryKey: notesQuery.queryKey });
  return EMPTY_NEW_NOTE;
}, EMPTY_NEW_NOTE);

// components/new-note-form.tsx: errors as values, the label tied to its input.
<form action={formAction}>
  <label htmlFor={`${id}-title`}>Title</label>
  <Input id={`${id}-title`} name="title" defaultValue={state.values.title}
    invalid={state.errors.title !== undefined} aria-describedby={...} />
  {state.errors.title === undefined ? null : <p id={...}>{state.errors.title}</p>}
  {state.formError === null ? null : <p role="alert">{state.formError}</p>}
```

- One validator: the `model/` function. Do not add native constraints (`required`,
  `type="email"`, `minLength`): the browser would run its check first and show its message
  instead of ours. Use `inputMode` and `autoComplete` for the keyboard and autofill.
- Bounds come from the contract: a field the API takes is checked with the contract's own Zod
  schema (imported from `@app/contracts`, exported from its `index.ts`), with the messages
  worded in `model/`. Never restate a length or a pattern on the web: it drifts from the server's.
- A refusal the user fixes on one field (a taken title) goes under that field; any other failure
  of the request goes above the submit button, `role="alert"`.
- Echo submitted values back through `defaultValue` so a failed attempt keeps what was typed.
- Messages say what to do: "Enter a title.", not "Invalid input".
- Tie each label to its control with `htmlFor` and the control's `id` (`useId()`):
  `jsx-a11y/label-has-associated-control` **[check]** does not see a design-system `Input`
  wrapped in a `<label>` as a control.

## Errors on the client

The client follows `docs/errors.md`: failures are values, typed from the contract.

- `api/` functions call the client through `fromPromise(() => api.x.y(input), failureOf("x.y"))`
  (`lib/api-failure.ts`), so a call returns `Result<Output, ApiFailure<"x.y">>`: each declared
  error as `{ type: <code in lower case>, ...data }`, plus `invalid_input`, `unreachable` and
  `unexpected`. Name the procedures; `ApiFailure` has no default.
- A query's `queryFn` converts that `Result` at one adapter, `unwrapForQuery`
  (`lib/query.adapter.ts`); the failure comes back as `query.error`, typed by the query options'
  second type argument (`queryOptions<Note[], ListFailure>`).
- Every failure is worded once, in the feature's `model/`, with a `Record` over the reason or
  type union (`features/system/model/health.ts`): a reason added in the contract does not compile
  until it has a sentence.
- A loader or `beforeLoad` failure renders the route's `errorComponent`.
- Redirects are control flow, not errors: decide with a pure function, then redirect. TanStack
  Router redirects by throwing, so the throw goes in a `lib/redirect.adapter.ts` when the first
  guard needs it.
- Where to show what: next to the field (validation, a refusal about that field), above the
  submit button (the request failed), a toast (an action without a form failed), the error
  component (the page could not load).

## Design system (`packages/ui`)

- **Tokens only** **[check]** `repo/design-tokens`. Colours are semantic utilities defined in
  `packages/ui/src/styles.css` (surfaces such as `bg-canvas` and `bg-surface`, text such as
  `text-fg`, `text-fg-muted` and `text-fg-subtle`, borders such as `border-line` and
  `border-line-strong`, the accent, status colours such as `text-success` and `text-danger`), and
  so are the type scale and the radii (Tailwind's shadows are reset; no shadow token exists yet).
  Tailwind's palette is switched off, and arbitrary values that hard-code a colour or a length
  (`w-[13px]`, `bg-[#fff]`, `style={{ color: "#fff" }}`) are rejected. If the design needs a value that does not exist, add a token. Read `styles.css`
  for the current list; it is the source of truth. The rule does not read `.css` files or numeric
  inline styles: keep raw values out of those by hand.
- **Dark and light** come from `light-dark()` in each token, so components never write `dark:`.
  The theme follows the OS unless the user picks one (`<html data-theme>`, `features/theme`).
- **Use the primitives** exported from `@app/ui` (`packages/ui/src/index.ts`: `Button`,
  `RadioGroup`, `RadioCard`, `Skeleton`) instead of styling raw elements. Inside `packages/ui`,
  merge classes through the `tv()` recipe's `className` argument (or `cn` from
  `tailwind-variants`, tested with the tokens in `packages/ui/src/cn.test.ts`). The template keeps
  only the primitives its screens use; add the next one with the recipe when a screen needs it,
  not before (Knip reports an unused export).
- **No logic, no data** in `packages/ui` **[check]**: components render what they get through props.
- **Icons: lucide-react only.** Icons are decorative: put the meaning in text or a label and pass
  `aria-hidden`. Size comes from the parent; standalone, use `className="size-4"`. Stroke width
  stays at the default.

## Accessibility baseline

- Every control has an accessible name: a visible label, button text, or an `aria-label` on an
  icon-only button. `jsx-a11y` rules **[check]** catch the common misses.
- Links are links: navigation is `<Link>`, never a button that navigates.
- A disabled control that explains itself stays focusable and carries the reason as
  `aria-description`: a tooltip alone is not announced.
- Everything works with the keyboard; never put `onClick` on a non-interactive element. Base UI
  provides focus management, roving focus in menus and lists, and Escape to close.
- Focus is visible: the base layer draws an outline on `:focus-visible`; do not remove it.
- Errors are announced: a field error is linked to its input (`aria-describedby`,
  `aria-invalid`); a form error has `role="alert"`.
- Text uses the foreground tokens on surfaces for contrast; the subtle text token is for hints
  and placeholders only.
- The e2e suite finds everything by role and accessible name; a screen it cannot drive that way
  has an accessibility bug.

## Narrow screens

The app should work down to a phone's width (about 390px) without a horizontal page scroll.
Inside a page, prefer a container query (`@container` and `@lg:...`) where the room depends on
the column rather than on the viewport. Lists keep their row height and drop secondary columns
as their container narrows. A sidebar becomes a modal drawer below `md`: focus moves into it and
back to its button when it closes, the page behind is inert, Escape and the backdrop close it.

## Tests

See `docs/testing.md`. In short: `model/` as plain functions (Node, fast), hooks and components
only where they hold behaviour (happy-dom + Testing Library, `renderWithApp` and a stubbed
`fetch` answered with `rpcOutput` / `rpcError`), queried by role and label like a user.

## Recipe: local data with optimistic writes (not in the template)

The template reads the API through TanStack Query. When screens need data that is already there
on every click, and writes that apply in the same frame, move the product's entities into a
client-side store (TanStack DB collections over Query, for example). The principles, whatever
the library:

1. **Scope every collection** to what it belongs to (the signed-in user and, if the product has
   them, the tenant), created once by one getter per scope and disposed with it. Collection ids
   and query keys include the scope, so two users never share rows. Signing out disposes every
   scope before the next screen renders.
2. **Preload in the route**: the layout route's loader preloads the collections its screens need,
   in parallel; components read them with live queries in `hooks/`, never with `useState` copies.
3. **One action per intent**, in the feature's `api/`, with two halves: a synchronous
   `onMutate` that applies the change to the collections, and a `mutationFn` that calls the API
   and writes back what the server returned (reconcile). If the call fails, everything
   `onMutate` did rolls back. Mint IDs on the client (a `newId()` in a pure ID package you add,
   `docs/architecture.md`, "Recipe: a table and its first migration") so a new row has its final
   ID from the first frame.
4. **Restrict what an action can call**: hand the `mutationFn` a client typed with only the
   procedures the action lists, so its failure type is exactly their `ApiFailure` and calling
   another does not compile.
5. **Show the outcome as a `Result`**: the hook awaits the action as a `Result` whose error is
   typed from the contract; a button shows a toast, a form puts it on a field, both with the
   sentence from the one place every reason is worded.
6. **What the server assigns** (a sequence number, a slug) is not guessed: show a placeholder
   until it answers.
7. **Test against a fake transport**: a real oRPC client whose link calls test handlers, so the
   test asserts apply, reconcile and roll back through the UI, with a held promise to observe the
   optimistic state.

Everything above stays enforced: the store is in `api/` and `lib/`, no effect syncs it, model
functions shape what live queries return.

## Recipe: gating controls by permission (not in the template)

When the API has a `can()` (`docs/backend.md`, "Recipe: permissions"), the UI asks the same
function, through the current user's access snapshot:

1. **One hook**, `useCan(action, resource)`, typed like `can()`, returning the decision with its
   reason. Nothing else in the web restates a rule.
2. **One component** for action controls, `<Gate decision={...}>{(control) => <Button
   {...control} />}</Gate>`: hidden when the user cannot change the outcome, disabled with the
   reason when they can (focusable, the reason as tooltip and `aria-description`).
3. **A value some may edit** is not "disabled": pick the editor or the read-only rendering with
   `useCan(...).allowed`.
4. **Every deny reason has one sentence**, in a `Record` over the reason union in a `model/`
   file, also used when the server answers `FORBIDDEN`. A new reason does not compile until it
   is worded.
5. **The UI never relies on its own check**: the API enforces every rule again. A gate that was
   stale shows the server's refusal with the same sentence.
6. If the product has limits beyond permission (a quota), they are the second question of the
   same hook, asked after the permission, so a control cannot skip either or ask them in the
   wrong order.
