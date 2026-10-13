import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    pool: "threads",
    exclude: ["node_modules", ".opencode", "dist", ".astro", "**/*.astro"],
  },
});
