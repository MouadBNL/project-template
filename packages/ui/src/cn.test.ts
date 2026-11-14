import { cn } from "tailwind-variants";
import { describe, expect, it } from "vite-plus/test";

// The class merger must understand our token names, or a `className` override would drop or keep
// the wrong class. These pin the cases components rely on.
describe("cn with design tokens", () => {
  it("keeps a size and a colour that share the text- prefix", () => {
    expect(cn("text-base text-fg-muted")).toBe("text-base text-fg-muted");
  });

  it("lets a later colour token win", () => {
    expect(cn("bg-surface text-fg", "bg-accent")).toBe("text-fg bg-accent");
    expect(cn("border border-line-strong", "border-danger")).toBe("border border-danger");
  });

  it("lets a later size win", () => {
    expect(cn("h-8 px-3 text-base", "h-7 text-sm")).toBe("px-3 h-7 text-sm");
  });
});
