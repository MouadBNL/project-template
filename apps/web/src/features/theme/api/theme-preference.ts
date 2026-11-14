import { readStorage, writeStorage } from "../../../lib/storage.adapter.ts";
import { parseThemePreference, themeAttribute, type ThemePreference } from "../model/theme.ts";

/** Also read by the inline script in index.html, which applies it before the first paint. */
const STORAGE_KEY = "app:theme";

/**
 * The theme preference is an external store: it lives in localStorage and on <html data-theme>,
 * and can change from another tab. Components read it with `useThemePreference()`
 * (useSyncExternalStore over `subscribe` / `getThemePreference`), never by copying it into state.
 */
const listeners = new Set<() => void>();

export function getThemePreference(): ThemePreference {
  const stored = readStorage(STORAGE_KEY);
  return parseThemePreference(stored.ok ? stored.value : null);
}

/** Sets <html data-theme> from the stored preference. Called once before the first render. */
export function applyThemePreference(preference = getThemePreference()): void {
  const attribute = themeAttribute(preference);
  if (attribute === null) delete document.documentElement.dataset["theme"];
  else document.documentElement.dataset["theme"] = attribute;
}

export function setThemePreference(preference: ThemePreference): void {
  // If storage is unavailable the choice still applies to this page; it is just not remembered.
  writeStorage(STORAGE_KEY, preference === "system" ? null : preference);
  applyThemePreference(preference);
  for (const listener of listeners) listener();
}

export function subscribeToThemePreference(listener: () => void): () => void {
  // Another tab changed the preference: apply it here too, then re-render readers.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    applyThemePreference();
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
