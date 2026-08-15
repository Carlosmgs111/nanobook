// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import rehypeSlug from 'rehype-slug';

const outputMode = process.env.OUTPUT_MODE || 'static';
const isDynamicMode = outputMode === 'dynamic';

// https://astro.build/config
export default defineConfig({
  output: isDynamicMode ? 'server' : 'static',
  adapter: isDynamicMode ? node({ mode: 'standalone' }) : undefined,
  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.OUTPUT_MODE': JSON.stringify(outputMode),
    },
  },
  markdown: {
    rehypePlugins: [rehypeSlug],
  },
});
