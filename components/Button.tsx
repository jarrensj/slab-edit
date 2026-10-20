import type { ComponentProps } from "react";

const VARIANTS = {
  primary: "bg-foreground font-medium text-background hover:bg-white",
  // For the one action that matters on a screen.
  accent: "bg-accent font-semibold text-on-accent hover:bg-accent-hover",
  secondary: "border border-line-strong font-medium hover:bg-white/6",
};

// 44px tall on touch screens so it's an easy thumb target; compact on desktop,
// and smaller still for "sm" (the side panel's section headers).
const SIZES = {
  md: "h-11 rounded-[10px] px-4 text-[15px]/5.5 pointer-fine:h-9 pointer-fine:rounded-lg pointer-fine:px-3.5 pointer-fine:text-sm",
  sm: "h-11 rounded-[10px] px-4 text-[15px]/5.5 pointer-fine:h-7.5 pointer-fine:rounded-[7px] pointer-fine:px-2.5 pointer-fine:text-[13px]/4.5",
};

type ButtonStyle = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

// Also for things that should look like a button without being one, such as
// the label inside the photo drop zone (itself a button).
export function buttonClass({
  variant = "secondary",
  size = "md",
}: ButtonStyle = {}) {
  return `inline-flex cursor-pointer touch-manipulation items-center justify-center gap-1.5 outline-offset-2 outline-sky-500 transition-colors focus-visible:outline-2 disabled:cursor-default disabled:opacity-50 ${SIZES[size]} ${VARIANTS[variant]}`;
}

export function Button({
  variant,
  size,
  className = "",
  ...props
}: ComponentProps<"button"> & ButtonStyle) {
  return (
    <button
      type="button"
      className={`${buttonClass({ variant, size })} ${className}`}
      {...props}
    />
  );
}
