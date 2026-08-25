// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import rehypeSlug from "rehype-slug";

const isVercelDeploy = process.env.VERCEL_DEPLOY === "true";

export default defineConfig({
  output: "server",
  adapter: isVercelDeploy
    ? vercel({
        webAnalytics: false,
        imageService: false,
      })
    : node({
        mode: "standalone",
      }),
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
