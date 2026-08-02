import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

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
  }),
});

export const collections = {
  content,
};
