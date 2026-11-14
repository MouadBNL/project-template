import { tv } from "tailwind-variants";

const skeleton = tv({ base: "animate-pulse rounded-md bg-active" });

export type SkeletonProps = {
  /** Size it like the content it stands in for: `className="h-4 w-40"`. */
  className?: string;
};

/**
 * A placeholder with the shape of content that is on its way. Prefer it to a spinner: the layout
 * does not jump when the content arrives. Hidden from assistive technology.
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={skeleton({ className })} />;
}
