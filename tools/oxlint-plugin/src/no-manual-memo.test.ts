import { noManualMemo } from "./no-manual-memo.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("no-manual-memo", noManualMemo, {
  valid: [
    "import { useState, use } from 'react';",
    "import { useMemo } from './not-react.ts';",
    // A field called memo on a row is not React's memo.
    "const row = { memo: 'note' }; row.memo.trim();",
    "import * as React from 'react'; React.useState(0);",
    "import type { memo } from 'react'; type M = typeof memo;",
  ],
  invalid: [
    {
      code: "import { useMemo, useCallback, memo } from 'react';",
      errors: [
        { messageId: "memo", data: { name: "useMemo" } },
        { messageId: "memo", data: { name: "useCallback" } },
        { messageId: "memo", data: { name: "memo" } },
      ],
    },
    {
      code: "import { useMemo as cached } from 'react';",
      errors: [{ messageId: "memo", data: { name: "useMemo" } }],
    },
    // The bypass: a namespace or default import.
    {
      code: "import * as React from 'react'; const x = React.useMemo(() => 1, []);",
      errors: [{ messageId: "memo", data: { name: "useMemo" } }],
    },
    {
      code: "import React from 'react'; export const C = React.memo(() => null);",
      errors: [{ messageId: "memo", data: { name: "memo" } }],
    },
    {
      code: "import React, { useState } from 'react'; React['useCallback'](() => {}, []);",
      errors: [{ messageId: "memo", data: { name: "useCallback" } }],
    },
    {
      code: "import * as React from 'react'; const { useCallback } = React;",
      errors: [{ messageId: "memo", data: { name: "useCallback" } }],
    },
    {
      code: "export { memo } from 'react';",
      errors: [{ messageId: "memo", data: { name: "memo" } }],
    },
  ],
});
