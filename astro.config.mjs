// @ts-check
import { defineConfig } from "astro/config";
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
});
