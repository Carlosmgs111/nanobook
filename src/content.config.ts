import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Colección local de contenido del proyecto.
 *
 * En el modelo SSR puro, Astro Content Collections solo gestiona los archivos
 * Markdown locales de `src/content/`. El contenido remoto (GitHub) se carga en
 * runtime mediante `ContentRepository`, no por el loader de Astro.
 */
const githubRefSchema = z.object({
  source: z.literal("github"),
  owner: z.string(),
  repo: z.string(),
  path: z.string(),
  branch: z.string().default("main"),
});

const localRefSchema = z.object({
  source: z.literal("local"),
  path: z.string(),
});

const urlRefSchema = z.object({
  source: z.literal("url"),
  url: z.string().url(),
});

const refSchema = z.union([
  z.string(),
  githubRefSchema,
  localRefSchema,
  urlRefSchema,
]).optional();

const content = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    author: z.string(),
    cover: z.string().optional(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
    index: z.boolean().default(false),
    position: z.number().default(0),
    ref: refSchema,
  }),
});

export const collections = {
  content,
};
