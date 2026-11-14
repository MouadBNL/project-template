import path from "node:path";
import { boundaries } from "./boundaries.ts";
import { ruleTester } from "./rule-tester.ts";
import { REPO_ROOT } from "./workspace.ts";

const options = [
  {
    zones: [
      { from: ["apps/web/**"], disallow: ["apps/api/**"], message: "web-to-api" },
      {
        from: ["apps/web/src/**"],
        except: ["apps/web/src/features/*/api/**"],
        disallow: ["apps/web/src/lib/orpc.ts"],
        message: "data-access",
      },
    ],
    externals: [
      { from: ["packages/result/**"], except: ["**/*.test.ts"], allow: [], message: "pure" },
      { from: ["packages/contracts/**"], allow: ["zod", "@orpc/*"], message: "pure" },
    ],
    modules: [{ root: "apps/api/src/modules" }, { root: "apps/web/src/features" }],
  },
];

const at = (file: string) => path.join(REPO_ROOT, file);

ruleTester.run("boundaries", boundaries, {
  valid: [
    {
      code: "import { contract } from '@app/contracts';",
      filename: at("apps/web/src/a.ts"),
      options,
    },
    { code: "import * as z from 'zod';", filename: at("packages/contracts/src/a.ts"), options },
    {
      code: "import { oc } from '@orpc/contract';",
      filename: at("packages/contracts/src/a.ts"),
      options,
    },
    {
      code: "import { it } from 'vite-plus/test';",
      filename: at("packages/result/src/a.test.ts"),
      options,
    },
    {
      code: "import { x } from './b.ts';",
      filename: at("apps/api/src/modules/users/a.ts"),
      options,
    },
    {
      code: "import { x } from '../orders/index.ts';",
      filename: at("apps/api/src/modules/users/a.ts"),
      options,
    },
    {
      code: "import { orpc } from '../../../lib/orpc.ts';",
      filename: at("apps/web/src/features/system/api/health.ts"),
      options,
    },
    {
      code: "import { Cart } from '../cart/index.ts';",
      filename: at("apps/web/src/features/catalog/a.ts"),
      options,
    },
  ],
  invalid: [
    {
      code: "import type { router } from '@app/api';",
      filename: at("apps/web/src/a.ts"),
      options,
      errors: [{ messageId: "boundary", data: { message: "web-to-api", specifier: "@app/api" } }],
    },
    {
      code: "import { x } from '../../../api/src/router.ts';",
      filename: at("apps/web/src/lib/a.ts"),
      options,
      errors: [{ messageId: "boundary" }],
    },
    {
      code: "import { readFileSync } from 'node:fs';",
      filename: at("packages/result/src/a.ts"),
      options,
      errors: [{ messageId: "boundary", data: { message: "pure", specifier: "node:fs" } }],
    },
    {
      code: "import { useState } from 'react';",
      filename: at("packages/contracts/src/a.ts"),
      options,
      errors: [{ messageId: "boundary", data: { message: "pure", specifier: "react" } }],
    },
    {
      code: "import { x } from '../orders/orders.repo.ts';",
      filename: at("apps/api/src/modules/users/a.ts"),
      options,
      errors: [{ messageId: "boundary" }],
    },
    {
      code: "import { orpc } from '../../../lib/orpc.ts';",
      filename: at("apps/web/src/features/system/components/status.tsx"),
      options,
      errors: [
        {
          messageId: "boundary",
          data: { message: "data-access", specifier: "../../../lib/orpc.ts" },
        },
      ],
    },
    {
      code: "import { CartItem } from '../cart/components/cart-item.tsx';",
      filename: at("apps/web/src/features/catalog/a.ts"),
      options,
      errors: [{ messageId: "boundary" }],
    },
    {
      code: "export { x } from './modules/orders/orders.repo.ts';",
      filename: at("apps/api/src/router.ts"),
      options,
      errors: [{ messageId: "boundary" }],
    },
  ],
});
