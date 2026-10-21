import type { MetadataRoute } from "next";

// Lets phones add slab edit to the home screen and open it like an app,
// without the browser's address bar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "slab edit",
    short_name: "slab edit",
    description:
      "Block out the serial numbers on your slabs and/or apply a watermark to your inventory before you share.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
