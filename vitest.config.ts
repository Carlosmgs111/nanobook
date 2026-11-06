import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    pool: "forks",
    maxWorkers: 4,
    exclude: ["node_modules", ".opencode", "dist", ".astro", "**/*.astro"],
  },
});
