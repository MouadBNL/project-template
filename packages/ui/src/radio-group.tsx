import { Radio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { useId, type ReactNode } from "react";
import { tv } from "tailwind-variants";

const radio = tv({
  slots: {
    group: "flex flex-col gap-2",
    card: [
      "flex cursor-default items-start gap-3 rounded-lg border border-line px-3 py-2.5 select-none",
      "transition-colors duration-100 has-data-checked:border-accent has-data-checked:bg-hover",
      "not-has-data-disabled:hover:bg-hover has-data-disabled:opacity-50",
    ],
    control: [
      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface",
      "data-checked:border-accent data-checked:bg-accent",
    ],
    indicator: "size-1.5 rounded-full bg-accent-fg data-unchecked:hidden",
    text: "flex min-w-0 flex-col gap-0.5",
    label: "text-base font-medium text-fg",
    description: "text-sm text-fg-muted",
  },
});
const styles = radio();

export type RadioGroupProps<Value> = {
  /** Accessible name of the choice, e.g. "Theme". */
  "aria-label": string;
  value: Value;
  onValueChange: (value: Value) => void;
  /** Read-only display of the current choice: every option is disabled. */
  disabled?: boolean | undefined;
  children: ReactNode;
  className?: string;
};

/**
 * Exactly one of a few options, each a `RadioCard`, optionally with a line that explains it.
 * Arrow keys move between the options and select them.
 */
export function RadioGroup<Value>({
  value,
  onValueChange,
  disabled,
  children,
  className,
  ...props
}: RadioGroupProps<Value>) {
  return (
    <BaseRadioGroup<Value>
      value={value}
      onValueChange={(next) => onValueChange(next)}
      disabled={disabled}
      className={styles.group({ className })}
      aria-label={props["aria-label"]}
    >
      {children}
    </BaseRadioGroup>
  );
}

export type RadioCardProps<Value> = {
  value: Value;
  label: string;
  /** One line under the label: what choosing it means. */
  description?: ReactNode;
  disabled?: boolean | undefined;
  /**
   * More of its description, outside the card: the id of a note about the option ("Needs a
   * restart."), read after `description`.
   */
  "aria-describedby"?: string | undefined;
};

/** One option of a `RadioGroup`, labelled by `label` and described by `description`. */
export function RadioCard<Value>({
  value,
  label,
  description,
  disabled,
  "aria-describedby": more,
}: RadioCardProps<Value>) {
  const labelId = useId();
  const descriptionId = useId();
  const describedBy = [description === undefined ? undefined : descriptionId, more]
    .filter((id) => id !== undefined)
    .join(" ");
  return (
    <label className={styles.card()}>
      <Radio.Root
        value={value}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        className={styles.control()}
      >
        <Radio.Indicator className={styles.indicator()} />
      </Radio.Root>
      <span className={styles.text()}>
        <span id={labelId} className={styles.label()}>
          {label}
        </span>
        {description === undefined ? null : (
          <span id={descriptionId} className={styles.description()}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
