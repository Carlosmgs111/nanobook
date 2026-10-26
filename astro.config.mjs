// @ts-check
import { defineConfig, envField } from "astro/config";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import rehypeSlug from "rehype-slug";

const isVercelDeploy = process.env.VERCEL === "1" || process.env.VERCEL_DEPLOY === "true";

const adapter = isVercelDeploy ? vercel({}) : node({ mode: "standalone" });

export default defineConfig({
  prefetch: true,
  output: "server",
  adapter: adapter,
  // Temporalmente permite el intercambio OAuth 2.1 de Codex: el token
  // endpoint requiere application/x-www-form-urlencoded y Better Auth valida
  // código, PKCE, cliente, recurso y scopes antes de emitir tokens.
  security: {
    checkOrigin: false,
  },
  vite: {
    resolve: {
      conditions: ["worker"],
    },
    plugins: [tailwindcss()],
    server: {
      watch: {
        // Reemplaza 'nombre-de-tu-carpeta' por la carpeta real
        ignored: ["**/content/**"],
      },
    },
  },
  markdown: {
    rehypePlugins: [rehypeSlug],
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
