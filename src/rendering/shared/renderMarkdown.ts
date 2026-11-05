import rehypeShiki from "@shikijs/rehype";
import type { Root } from "hast";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { assertUniqueExtensionIds, type MarkdownExtension } from "./MarkdownExtension";

export async function renderMarkdown(
  source: string,
  extensions: readonly MarkdownExtension[] = [],
): Promise<string> {
  assertUniqueExtensionIds(extensions);

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(function applyExtensions() {
      return (tree: Root) => {
        for (const extension of extensions) extension.transform(tree);
      };
    })
    .use(rehypeSlug)
    .use(rehypeShiki, { theme: "github-dark" })
    .use(rehypeStringify)
    .process(source);

  return String(result);
}
