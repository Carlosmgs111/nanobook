// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import rehypeSlug from "rehype-slug";

export default defineConfig({
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@/": new URL("./src/", import.meta.url).pathname,
      },
    },
    define: {
      "process.env": {},
      "process.browser": true,
    },
  },
  markdown: {
    rehypePlugins: [rehypeSlug],
  },
  server: ({ command }) => ({
    port: command === "dev" ? 4321 : 4320,
  }),
});
