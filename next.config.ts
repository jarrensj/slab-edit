import { hostname, networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Lets a phone on the same Wi-Fi open `npm run dev` at this machine's LAN
// address (the "Network:" URL it prints). Next blocks other hosts from its dev
// resources by default, so the page would load but never become interactive.
// Read at startup, so it follows you between networks after a restart.
const lanHosts = [
  hostname(),
  ...Object.values(networkInterfaces())
    .flat()
    .filter((net) => net?.family === "IPv4" && !net.internal)
    .map((net) => net!.address),
];

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: lanHosts,
  experimental: {
    agentFeedback: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
