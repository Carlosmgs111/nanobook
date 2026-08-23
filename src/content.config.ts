import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { github } from "./document/adapters/github-loader";

const outputMode = process.env.OUTPUT_MODE || "static";
const isDynamicMode = outputMode === "dynamic";

const staticLoader = glob({ pattern: "**/*.md", base: "./src/content/" });
const dynamicLoader = github({
  owner: import.meta.env.GITHUB_OWNER || "",
  repo: "nanobook-content",
  path: "",
  branch: "main",
  pattern: ["**/*.md", "!README.md"],
  token: import.meta.env.GITHUB_TOKEN,
});

/**
 * Colección de contenido condicional según el modo de despliegue.
 *
 * - Modo estático: solo archivos Markdown locales en `src/content/`.
 * - Modo dinámico: contenido remoto desde GitHub (fuente de verdad externa).
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
  loader: isDynamicMode ? dynamicLoader : staticLoader,
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
