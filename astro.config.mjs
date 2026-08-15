// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import rehypeSlug from 'rehype-slug';
import { editorPlugin } from './src/lib/editor/vite-plugin';

const outputMode = process.env.OUTPUT_MODE || 'static';
const isDynamicMode = outputMode === 'dynamic';
const isDev = process.env.NODE_ENV !== 'production';

// https://astro.build/config
export default defineConfig({
  output: isDynamicMode ? 'server' : 'static',
  adapter: isDynamicMode ? node({ mode: 'standalone' }) : undefined,
  vite: {
    plugins: [tailwindcss(), editorPlugin({ enabled: isDev })],
    define: {
      'import.meta.env.OUTPUT_MODE': JSON.stringify(outputMode),
    },
  },
  markdown: {
    rehypePlugins: [rehypeSlug],
  },
});
