import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "slab edit",
  description:
    "Block out the serial numbers on your slabs and/or apply a watermark to your inventory before you share.",
};

// On wider screens the page is a fixed-height app shell: the editor's side
// panel runs the full height between the header and the footer. Phones scroll
// as usual.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-dvh flex-col text-[15px]/5.5 sm:h-dvh sm:text-sm">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4 sm:h-13 sm:px-6">
          <div className="flex items-center gap-2.5 text-sm font-medium tracking-[-0.01em] whitespace-nowrap">
            <span aria-hidden className="size-1.75 rounded-xs bg-accent" />
            slab edit
          </div>
          <p className="text-xs text-muted sm:text-[13px]">
            <span className="sm:hidden">On-device only</span>
            <span className="hidden sm:inline">
              Photos never leave your device
            </span>
          </p>
        </header>
        {children}
        {/* Opens in a new tab, so a photo that's being edited isn't lost. */}
        <footer className="flex shrink-0 items-center justify-center border-t border-line px-4 pb-[env(safe-area-inset-bottom)] text-xs text-faint sm:h-9 sm:pb-0">
          <p>
            Made by{" "}
            <a
              href="https://kwaji.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground sm:min-h-0"
            >
              kwaji
            </a>
          </p>
        </footer>
        {/* Vercel Web Analytics: anonymous page views, no cookies. Photos are
            never sent. TODO: once there's a Privacy Policy page, disclose
            this there. */}
        <Analytics />
      </body>
    </html>
  );
}
