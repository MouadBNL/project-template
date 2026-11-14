import { RadioCard, RadioGroup } from "@app/ui";
import { useThemePreference } from "../hooks/use-theme-preference.ts";
import { THEME_LABELS, THEME_PREFERENCES, type ThemePreference } from "../model/theme.ts";

/** Theme picker: System, Light, Dark. Applies at once and is remembered in this browser. */
export function ThemePicker() {
  const [preference, setPreference] = useThemePreference();
  return (
    <section className="flex flex-col gap-3" aria-labelledby="theme-picker">
      <h2 id="theme-picker" className="text-lg font-medium">
        Theme
      </h2>
      <RadioGroup<ThemePreference>
        aria-label="Theme"
        value={preference}
        onValueChange={setPreference}
      >
        {THEME_PREFERENCES.map((option) => (
          <RadioCard key={option} value={option} label={THEME_LABELS[option]} />
        ))}
      </RadioGroup>
    </section>
  );
}
