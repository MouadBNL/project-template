import { noEffect } from "./no-effect.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("no-effect", noEffect, {
  valid: [
    "import { useState, useImperativeHandle, useSyncExternalStore } from 'react';",
    "import { useEffect } from './my-hooks';",
    // Not React: a property that happens to share the name.
    "const hooks = { useEffect() {} }; hooks.useEffect();",
    "import type { useEffect } from 'react';",
    "import * as React from 'react'; React.useState(0);",
  ],
  invalid: [
    {
      code: "import { useEffect, useState } from 'react';",
      errors: [{ messageId: "effect", data: { name: "useEffect" } }],
    },
    {
      code: "import { useLayoutEffect as ule } from 'react';",
      errors: [{ messageId: "effect", data: { name: "useLayoutEffect" } }],
    },
    {
      code: "import { useInsertionEffect } from 'react';",
      errors: [{ messageId: "effect", data: { name: "useInsertionEffect" } }],
    },
    {
      code: "import { useEffectEvent } from 'react';",
      errors: [{ messageId: "effect", data: { name: "useEffectEvent" } }],
    },
    {
      code: "import * as React from 'react'; React.useEffect(() => {});",
      errors: [{ messageId: "effect", data: { name: "useEffect" } }],
    },
    {
      code: "import React from 'react'; React.useInsertionEffect(() => {});",
      errors: [{ messageId: "effect", data: { name: "useInsertionEffect" } }],
    },
    {
      code: "import * as R from 'react'; R['useLayoutEffect'](() => {});",
      errors: [{ messageId: "effect", data: { name: "useLayoutEffect" } }],
    },
    {
      code: "import React from 'react'; const { useEffect: run } = React;",
      errors: [{ messageId: "effect", data: { name: "useEffect" } }],
    },
    {
      code: "export { useEffect } from 'react';",
      errors: [{ messageId: "effect", data: { name: "useEffect" } }],
    },
  ],
});
