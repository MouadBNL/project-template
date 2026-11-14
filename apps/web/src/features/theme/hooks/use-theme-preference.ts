import { useSyncExternalStore } from "react";
import {
  getThemePreference,
  setThemePreference,
  subscribeToThemePreference,
} from "../api/theme-preference.ts";
import type { ThemePreference } from "../model/theme.ts";

/** The current theme preference and a setter. Reads the external store; no effect, no copy. */
export function useThemePreference(): readonly [ThemePreference, (next: ThemePreference) => void] {
  const preference = useSyncExternalStore(subscribeToThemePreference, getThemePreference);
  return [preference, setThemePreference];
}
