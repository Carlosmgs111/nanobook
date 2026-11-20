// @ts-check
import { defineConfig, envField } from "astro/config";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import { loadEnv } from "vite";

// Astro evalúa este archivo antes de cargar los .env y el servidor lee process.env (p. ej. DATABASE_URL),
// así que se vuelcan aquí .env y .env.local. Lo ya definido (shell o `node --env-file`, como en `dev:staging`) gana.
const mode = process.argv.includes("build") ? "production" : "development";
for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const isVercelDeploy = process.env.VERCEL === "1" || process.env.VERCEL_DEPLOY === "true";

const adapter = isVercelDeploy ? vercel({}) : node({ mode: "standalone" });
const betterAuthUrl = process.env.BETTER_AUTH_URL;
const allowedDomains = betterAuthUrl
  ? (() => {
      const origin = new URL(betterAuthUrl);
      return [{
        protocol: origin.protocol.slice(0, -1),
        hostname: origin.hostname,
        port: origin.port,
      }];
    })()
  : [];

export default defineConfig({
  prefetch: true,
  // Integraciones de los frameworks de los componentes de bloque (`*.block.ts`).
  integrations: [react()],
  output: "server",
  adapter: adapter,
  security: {
    checkOrigin: false,
    allowedDomains,
  },
  vite: {
    resolve: {
      conditions: ["worker"],
    },
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Se importa de forma diferida; sin esto Vite la descubre tarde y la
      // primera carga en dev falla con 504 "Outdated Optimize Dep".
      include: ["lightweight-charts"],
    },
  },
  server: ({ command }) => ({
    port: command === "dev" ? 4322 : 4320,
  }),
  env: {
    schema: {
      DATABASE_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      DATABASE_AUTH_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GITHUB_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GITHUB_OAUTH_CLIENT_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GITHUB_OAUTH_CLIENT_SECRET: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      BETTER_AUTH_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      BETTER_AUTH_SECRET: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      RESEND_API_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      EMAIL_FROM: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      REDIS_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      CACHE_BACKEND: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      INVALIDATE_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
});
