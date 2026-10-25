"use client";

import Link from "next/link";

// Fired, cancelable, when the logo is clicked. The header lives in the
// layout, outside the editor, so this is how the editor hears about it: it
// cancels the event while photos are open and asks before clearing them.
export const HOME_EVENT = "slab-edit:home";

// The logo in the header. The pseudo-element pads the tap target out to about
// 44px without taking up any room.
export function HomeLink() {
  return (
    <Link
      href="/"
      onNavigate={(e) => {
        const event = new Event(HOME_EVENT, { cancelable: true });
        if (!window.dispatchEvent(event)) e.preventDefault();
      }}
      className="relative flex touch-manipulation items-center gap-2.5 text-sm font-medium tracking-[-0.01em] whitespace-nowrap outline-offset-2 outline-sky-500 transition-opacity before:absolute before:-inset-3 hover:opacity-80 focus-visible:outline-2"
    >
      <span aria-hidden className="size-1.75 rounded-xs bg-accent" />
      slab edit
    </Link>
  );
}
