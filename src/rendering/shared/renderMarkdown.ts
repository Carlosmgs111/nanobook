import rehypeShiki from "@shikijs/rehype";
import type { Root } from "hast";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { assertUniqueExtensionIds, type MarkdownExtension } from "./MarkdownExtension";

const defaultExtensions: readonly MarkdownExtension[] = [];
const processors = new WeakMap<readonly MarkdownExtension[], ReturnType<typeof createProcessor>>();

function createProcessor(extensions: readonly MarkdownExtension[]) {
  return unified()
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
    .freeze();
}

export async function renderMarkdown(
  source: string,
  extensions: readonly MarkdownExtension[] = defaultExtensions,
): Promise<string> {
  assertUniqueExtensionIds(extensions);

  let processor = processors.get(extensions);
  if (!processor) {
    processor = createProcessor(extensions);
    processors.set(extensions, processor);
  }

  return String(await processor.process(source));
}
