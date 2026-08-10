import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { github } from "./loaders/github";
import { mixed } from "./loaders/mixed";

const content = defineCollection({
  loader: mixed([
    glob({ pattern: "**/*.md", base: "./src/content/" }),
    github({
      owner: import.meta.env.GITHUB_OWNER || "",
      repo: "nanobook-content",
      path: "",
      branch: "main",
      pattern: "**/*.md",
      token: import.meta.env.GITHUB_TOKEN,
    }),
  ]),
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
