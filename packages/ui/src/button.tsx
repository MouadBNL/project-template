import { Button as BaseButton } from "@base-ui/react/button";
import { tv, type VariantProps } from "tailwind-variants";

const button = tv({
  base: [
    "inline-flex shrink-0 cursor-default items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap select-none",
    "transition-colors duration-100 data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  variants: {
    variant: {
      primary: "bg-accent text-accent-fg not-data-disabled:hover:bg-accent-hover",
      secondary: "border border-line-strong bg-surface text-fg not-data-disabled:hover:bg-hover",
      ghost: "text-fg-muted not-data-disabled:hover:bg-hover not-data-disabled:hover:text-fg",
      danger: "bg-danger text-accent-fg not-data-disabled:hover:opacity-90",
    },
    size: {
      sm: "h-7 px-2.5 text-sm",
      md: "h-8 px-3 text-base",
      lg: "h-9 px-4 text-base",
    },
  },
  defaultVariants: { variant: "secondary", size: "md" },
});

export type ButtonProps = Omit<BaseButton.Props, "className"> &
  VariantProps<typeof button> & {
    className?: string;
    /** An action is running: disables the button but keeps it focusable and announces it busy. */
    pending?: boolean;
  };

/** The default action control. Renders a native <button>. */
export function Button({
  variant,
  size,
  className,
  pending = false,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      type={type}
      disabled={pending || disabled}
      focusableWhenDisabled={pending}
      aria-busy={pending || undefined}
      className={button({ variant, size, className })}
      {...props}
    />
  );
}
