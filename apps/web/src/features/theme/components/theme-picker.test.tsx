import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ThemePicker } from "./theme-picker.tsx";

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset["theme"];
});

describe("ThemePicker", () => {
  it("follows the system until a theme is picked, then pins and remembers it", async () => {
    render(<ThemePicker />);
    expect(screen.getByRole("radio", { name: "System" }).getAttribute("aria-checked")).toBe("true");

    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(screen.getByRole("radio", { name: "Dark" }).getAttribute("aria-checked")).toBe("true");
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(window.localStorage.getItem("app:theme")).toBe("dark");
  });

  it("removes the pin when System is picked again", async () => {
    window.localStorage.setItem("app:theme", "light");
    render(<ThemePicker />);

    await userEvent.click(screen.getByRole("radio", { name: "System" }));

    expect(document.documentElement.dataset["theme"]).toBeUndefined();
    expect(window.localStorage.getItem("app:theme")).toBeNull();
  });
});
