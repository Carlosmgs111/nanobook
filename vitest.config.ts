import { defineConfig } from "vitest/config";

export default defineConfig({
  // `tsconfig` usa `jsx: "preserve"` (lo transforma la integración de Astro); las
  // pruebas necesitan que se transforme para poder renderizar componentes en servidor.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    globals: false,
    environment: "node",
    pool: "forks",
    maxWorkers: 4,
    exclude: ["node_modules", ".opencode", "dist", ".astro", "**/*.astro", "**/*.astro.test.ts"],
  },
});
