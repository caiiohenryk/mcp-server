import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep AGENTS.md as the single hand-written source of agent rules (no auto-appended block).
  agentRules: false,
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
