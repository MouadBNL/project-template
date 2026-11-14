import { designTokens } from "./design-tokens.ts";
import { ruleTester } from "./rule-tester.ts";

ruleTester.run("design-tokens", designTokens, {
  valid: [
    '<div className="flex h-8 items-center gap-2 rounded-md bg-surface px-3 text-sm text-fg-muted" />',
    // Arbitrary variants, CSS-variable shorthands and non-length arbitrary values are fine.
    '<div className="data-[side=top]:mb-1 [&_svg]:size-4 origin-(--transform-origin) grid-cols-[1fr_auto]" />',
    '<div className="max-h-[60vh] pt-[12vh] w-(--sidebar-width)" />',
    "const button = tv({ base: 'bg-accent text-accent-fg', variants: { size: { sm: 'h-7' } } });",
    "<div className={cn('text-fg', active && 'bg-active')} />",
    // Strings outside class contexts are not classes.
    "const label = 'Use #fff and 12px';",
    '<a href="#top" title="text-red-500" />',
    "<div style={{ width: 'var(--sidebar-width)' }} />",
  ],
  invalid: [
    {
      code: '<div className="bg-neutral-900 text-white" />',
      errors: [
        { messageId: "palette", data: { value: "bg-neutral-900" } },
        { messageId: "palette", data: { value: "text-white" } },
      ],
    },
    {
      code: '<div className="hover:border-red-500/50" />',
      errors: [{ messageId: "palette", data: { value: "hover:border-red-500/50" } }],
    },
    {
      code: '<div className="w-[13px] bg-[#5e6ad2] text-[oklch(0.5_0.1_200)]" />',
      errors: [
        { messageId: "arbitrary", data: { value: "w-[13px]" } },
        { messageId: "arbitrary", data: { value: "bg-[#5e6ad2]" } },
        { messageId: "arbitrary", data: { value: "text-[oklch(0.5_0.1_200)]" } },
      ],
    },
    {
      code: "const button = tv({ variants: { size: { sm: 'h-[30px] px-2' } } });",
      errors: [{ messageId: "arbitrary", data: { value: "h-[30px]" } }],
    },
    {
      code: "<div className={`flex ${open ? 'bg-zinc-800' : ''} mt-[0.5rem]`} />",
      errors: [
        { messageId: "palette", data: { value: "bg-zinc-800" } },
        { messageId: "arbitrary", data: { value: "mt-[0.5rem]" } },
      ],
    },
    {
      code: "<div style={{ color: '#ff0000', width: '240px' }} />",
      errors: [
        { messageId: "style", data: { value: "#ff0000" } },
        { messageId: "style", data: { value: "240px" } },
      ],
    },
  ],
});
