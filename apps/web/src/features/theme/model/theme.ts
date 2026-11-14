/** The user's choice. "system" follows the OS; the others pin a scheme. */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

/** Reads a stored value; anything unknown (old versions, hand edits, nothing stored) is "system". */
export function parseThemePreference(stored: string | null): ThemePreference {
  return THEME_PREFERENCES.find((preference) => preference === stored) ?? "system";
}

/** The `data-theme` attribute for <html>, or null to remove it and follow the OS. */
export function themeAttribute(preference: ThemePreference): "light" | "dark" | null {
  return preference === "system" ? null : preference;
}

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};
