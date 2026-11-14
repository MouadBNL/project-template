import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { RadioCard, RadioGroup } from "./radio-group.tsx";

function Visibility({
  onValueChange,
  disabled,
}: {
  onValueChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      aria-label="Visibility"
      value="public"
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <RadioCard value="public" label="Everyone" description="Anyone with the link." />
      <RadioCard value="private" label="Only me" description="Nobody else." />
    </RadioGroup>
  );
}

/** The text of the elements `element`'s `aria-describedby` names: what is read after its name. */
const description = (element: Element) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

describe("RadioGroup", () => {
  it("adds a note outside the card to the option's description, after its own", () => {
    render(
      <>
        <RadioGroup aria-label="Visibility" value="public" onValueChange={() => undefined}>
          <RadioCard
            value="private"
            label="Only me"
            description="Nobody else."
            aria-describedby="note"
          />
        </RadioGroup>
        <p id="note">Takes effect at once.</p>
      </>,
    );
    const onlyMe = screen.getByRole("radio", { name: "Only me" });
    expect(description(onlyMe)).toBe("Nobody else. Takes effect at once.");
  });

  it("picks an option by its card, named and described by its text", async () => {
    const onValueChange = vi.fn<(value: string) => void>();
    render(<Visibility onValueChange={onValueChange} />);

    const onlyMe = screen.getByRole("radio", { name: "Only me" });
    expect(onlyMe.getAttribute("aria-describedby")).toBeTruthy();
    await userEvent.click(screen.getByText("Nobody else."));

    expect(onValueChange).toHaveBeenCalledWith("private");
  });

  it("does not change while disabled", async () => {
    const onValueChange = vi.fn<(value: string) => void>();
    render(<Visibility onValueChange={onValueChange} disabled />);

    await userEvent.click(screen.getByText("Only me"));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Everyone" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });
});
