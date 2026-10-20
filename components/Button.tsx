import type { ComponentProps } from "react";

const VARIANTS = {
  primary: "bg-foreground text-background hover:bg-foreground/85",
  secondary: "border border-foreground/20 hover:bg-foreground/5",
};

// 44px tall on touch screens so it's an easy thumb target; compact on desktop.
export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      type="button"
      className={`inline-flex h-11 cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-lg px-4 text-base font-medium transition-colors disabled:cursor-default disabled:opacity-50 pointer-fine:h-9 pointer-fine:px-3 pointer-fine:text-sm ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
