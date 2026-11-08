import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["src/server/**"],
      thresholds: { lines: 80, functions: 80, branches: 75 },
    },
  },
});
