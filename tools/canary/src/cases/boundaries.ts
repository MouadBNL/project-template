import { fires, lines, passes, type Case } from "../case.ts";

const ZONES = "the zones of `repo/boundaries` in lint.rules";

export const BOUNDARY_CASES: readonly Case[] = [
  {
    convention: "apps/web imports neither apps/api nor packages/db; packages import no app",
    config: ZONES,
    samples: [
      fires(
        "apps/web/src/lib/canary-api-version.ts",
        lines(
          'import { version } from "../../../api/src/canary-version.ts";',
          "export const apiVersion = version;",
        ),
        "repo/boundaries",
      ),
      fires(
        "apps/web/src/lib/canary-db-version.ts",
        lines(
          'import { version } from "../../../../packages/db/src/canary-version.ts";',
          "export const dbVersion = version;",
        ),
        "repo/boundaries",
      ),
      fires(
        "packages/result/src/canary-app-version.ts",
        lines(
          'import { version } from "../../../apps/api/src/canary-version.ts";',
          "export const appVersion = version;",
        ),
        "repo/boundaries",
      ),
      passes("apps/api/src/canary-version.ts", lines('export const version = "1";')),
      passes("packages/db/src/canary-version.ts", lines('export const version = "1";')),
    ],
  },
  {
    convention: "packages/ui renders: it imports no other workspace package",
    config: "the `packages/ui/**` zone of `repo/boundaries`",
    samples: [
      fires(
        "packages/ui/src/canary-total.tsx",
        lines(
          'import { total } from "../../result/src/canary-sum.ts";',
          "export function Total() {",
          "  return <p>{total}</p>;",
          "}",
        ),
        "repo/boundaries",
      ),
      passes("packages/result/src/canary-sum.ts", lines("export const total = 3;")),
    ],
  },
  {
    convention: "src/lib imports no feature or route; features import no route",
    config: ZONES,
    samples: [
      fires(
        "apps/web/src/lib/canary-feature.ts",
        lines(
          'import { size } from "../features/canary-zones/model/size.ts";',
          "export const libSize = size;",
        ),
        "repo/boundaries",
      ),
      fires(
        "apps/web/src/lib/canary-route.ts",
        lines(
          'import { Route } from "../routes/canary-zones.tsx";',
          "export const libRoute = Route;",
        ),
        "repo/boundaries",
      ),
      fires(
        "apps/web/src/features/canary-zones/model/route.ts",
        lines(
          'import { Route } from "../../../routes/canary-zones.tsx";',
          "export const featureRoute = Route;",
        ),
        "repo/boundaries",
      ),
      passes("apps/web/src/features/canary-zones/model/size.ts", lines("export const size = 3;")),
      passes(
        "apps/web/src/routes/canary-zones.tsx",
        lines('export const Route = { path: "/zones" };'),
      ),
    ],
  },
  {
    convention: "pure packages import only their allowlist: no Node built-in, no React",
    config: 'the PURE_PACKAGES externals of `repo/boundaries`, and `"types": []` in their tsconfig',
    samples: [
      fires(
        "packages/result/src/canary-node.ts",
        lines('import type { ParsedPath } from "node:path";', "export type Parsed = ParsedPath;"),
        "repo/boundaries",
        "type-check",
      ),
      fires(
        "packages/contracts/src/canary-react.ts",
        lines('import type { ReactNode } from "react";', "export type Slot = ReactNode;"),
        "repo/boundaries",
        "type-check",
      ),
      passes(
        "packages/contracts/src/canary-ping.ts",
        lines(
          'import { oc } from "@orpc/contract";',
          'import * as z from "zod";',
          "export const ping = oc.output(z.object({ ok: z.boolean() }));",
        ),
      ),
    ],
  },
  {
    convention: "packages/ui imports only React, Base UI, lucide-react and tailwind-variants",
    config: "the `packages/ui/src/**` externals of `repo/boundaries` (UI_EXTERNALS)",
    samples: [
      fires(
        "packages/ui/src/canary-render.ts",
        lines('import { render } from "@testing-library/react";', "export const draw = render;"),
        "repo/boundaries",
      ),
      passes(
        "packages/ui/src/canary-press.tsx",
        lines(
          'import { Button as BaseButton } from "@base-ui/react/button";',
          'import { tv } from "tailwind-variants";',
          'const press = tv({ base: "rounded-md bg-surface text-fg" });',
          "export function Press() {",
          "  return <BaseButton className={press()}>Press</BaseButton>;",
          "}",
        ),
      ),
      passes(
        "packages/ui/src/test-setup.ts",
        lines(
          'import { cleanup } from "@testing-library/react";',
          'import { afterEach } from "vite-plus/test";',
          "afterEach(cleanup);",
        ),
      ),
    ],
  },
  {
    convention: "model/ imports no npm package but zod",
    config: "the `features/*/model/**` externals of `repo/boundaries`",
    samples: [
      fires(
        "apps/web/src/features/canary-zones/model/state.ts",
        lines('import { useState } from "react";', "export const state = useState;"),
        "repo/boundaries",
      ),
    ],
  },
  {
    convention: "another API module or web feature only through its index.ts",
    config: "`modules` of `repo/boundaries` (apps/api/src/modules, apps/web/src/features)",
    samples: [
      fires(
        "apps/api/src/modules/canary-alpha/alpha.service.ts",
        lines(
          'import { limit } from "../canary-beta/beta.repo.ts";',
          "export const twice = limit * 2;",
        ),
        "repo/boundaries",
      ),
      passes(
        "apps/api/src/modules/canary-alpha/alpha.router.ts",
        lines(
          'import { limit } from "../canary-beta/index.ts";',
          "export const thrice = limit * 3;",
        ),
      ),
      passes("apps/api/src/modules/canary-beta/beta.repo.ts", lines("export const limit = 2;")),
      passes(
        "apps/api/src/modules/canary-beta/index.ts",
        lines('export { limit } from "./beta.repo.ts";'),
      ),
      fires(
        "apps/web/src/features/canary-gamma/model/twice.ts",
        lines(
          'import { size } from "../../canary-zones/model/size.ts";',
          "export const twice = size * 2;",
        ),
        "repo/boundaries",
      ),
      passes(
        "apps/web/src/features/canary-gamma/model/thrice.ts",
        lines(
          'import { size } from "../../canary-zones/index.ts";',
          "export const thrice = size * 3;",
        ),
      ),
      passes(
        "apps/web/src/features/canary-zones/index.ts",
        lines('export { size } from "./model/size.ts";'),
      ),
    ],
  },
  {
    convention: "no import cycles, no module importing itself",
    config: "`import/no-cycle` and `import/no-self-import` in lint.rules",
    samples: [
      fires(
        "packages/result/src/canary-ping.ts",
        lines(
          'import { pong } from "./canary-pong.ts";',
          "export const ping = (): number => pong() + 1;",
        ),
        "import/no-cycle",
      ),
      fires(
        "packages/result/src/canary-pong.ts",
        lines(
          'import { ping } from "./canary-ping.ts";',
          "export const pong = (): number => 1;",
          "export const again = (): number => ping();",
        ),
        "import/no-cycle",
      ),
      fires(
        "packages/result/src/canary-self.ts",
        lines(
          'import * as self from "./canary-self.ts";',
          "export const one = 1;",
          "export const two = (): number => self.one + 1;",
        ),
        "import/no-self-import",
        "import/no-cycle",
      ),
    ],
  },
];
