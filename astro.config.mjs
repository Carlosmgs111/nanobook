// @ts-check
import { defineConfig, envField } from "astro/config";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import rehypeSlug from "rehype-slug";

const isVercelDeploy = Boolean(process.env.VERCEL_DEPLOY);

const adapter = isVercelDeploy ? vercel({}) : node({ mode: "standalone" });

export default defineConfig({
  output: "server",
  adapter: adapter,
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    rehypePlugins: [rehypeSlug],
  },
  server: ({ command }) => ({
    port: command === "dev" ? 4322 : 4320,
  }),
  env: {
    schema: {
      CONTENT_SOURCE: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GITHUB_BRANCH: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GITHUB_OWNER: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GITHUB_PATH: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GITHUB_REPO: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GITHUB_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      GITHUB_WEBHOOK_SECRET: envField.string({
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
    },
  },
});
