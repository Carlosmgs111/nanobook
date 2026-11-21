import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./renderMarkdown";

/** El pipeline anterior: `@shikijs/rehype` sin `langs`, que carga todos los lenguajes empaquetados. */
const legacy = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeShiki, { theme: "github-dark" })
  .use(rehypeStringify)
  .freeze();

describe("rehypeShikiLazy", () => {
  it("highlights a fence with a bundled language", async () => {
    const html = await renderMarkdown("```ts\nconst a: number = 1;\n```");
    expect(html).toContain('class="shiki github-dark"');
    expect(html).toContain("<span");
  }, 30_000);

  it("leaves a document without code untouched", async () => {
    expect(await renderMarkdown("# Solo texto")).toBe('<h1 id="solo-texto">Solo texto</h1>');
  });

  it("does not highlight languages Shiki does not bundle, and does not fail", async () => {
    const html = await renderMarkdown("```desconocido\nvalor\n```\n\n```constructor\nvalor\n```");
    expect(html).toContain('<code class="language-desconocido">');
    expect(html).toContain('<code class="language-constructor">');
  });

  it("produces the same HTML as the previous pipeline", async () => {
    const markdown = [
      "# Título",
      "```ts\nconst a: number = 1;\n```",
      "```sql\nSELECT 1;\n```",
      "```python\nprint(1)\n```",
      "```js\nconsole.log(1)\n```",
      "```bash\necho hi\n```",
      "```diff\n- a\n+ b\n```",
      "```desconocido\nnada\n```",
      "```\nsin lenguaje\n```",
    ].join("\n\n");

    expect(await renderMarkdown(markdown)).toBe(String(await legacy.process(markdown)));
  }, 30_000);

  it("renders the same fences twice with the same HTML once the language is loaded", async () => {
    const markdown = "```rust\nfn main() {}\n```";
    expect(await renderMarkdown(markdown)).toBe(await renderMarkdown(markdown));
  });
});
