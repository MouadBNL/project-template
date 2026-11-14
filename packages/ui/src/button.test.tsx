import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { Button } from "./button.tsx";

describe("Button", () => {
  it("is a type=button by default, so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("button");
  });

  it("while pending: ignores clicks, stays focusable and is announced busy", async () => {
    const onClick = vi.fn<() => void>();
    render(
      <Button pending onClick={onClick}>
        Saving…
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving…" });

    await userEvent.click(button);
    button.focus();

    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(button);
  });

  it("when disabled: ignores clicks and leaves the tab order", async () => {
    const onClick = vi.fn<() => void>();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });
});
