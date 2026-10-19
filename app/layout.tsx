import type { Metadata, Viewport } from "next";
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
  // Name and full-screen launch when added to an iPhone's home screen.
  appleWebApp: { capable: true, title: "slab edit" },
};

// Matches the browser's toolbar to the page background in light and dark mode.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <footer className="fixed inset-x-0 bottom-0 p-4 text-center">
          We don&apos;t upload your photos anywhere.
        </footer>
      </body>
    </html>
  );
}
