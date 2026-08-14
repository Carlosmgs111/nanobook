import { toString } from "mdast-util-to-string";
import { slug } from "github-slugger";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Node } from "unist";

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface Document {
  headings: Heading[];
}

export interface DocumentSource {
  body?: string;
}

function stripFrontmatter(source: string): string {
  return source.replace(/^---[\s\S]*?---\n?/, "");
}

function extractHeadings(source: string): Heading[] {
  const tree = unified().use(remarkParse).parse(source);
  const headings: Heading[] = [];

  const visit = (node: Node) => {
    const anyNode = node as any;
    if (anyNode.type === "heading" && anyNode.depth >= 2 && anyNode.depth <= 3) {
      const text = toString(anyNode);
      const headingSlug = slug(text);
      if (headingSlug) {
        headings.push({ depth: anyNode.depth, slug: headingSlug, text });
      }
    }
    if (anyNode.children && Array.isArray(anyNode.children)) {
      anyNode.children.forEach(visit);
    }
  };

  visit(tree);
  return headings;
}

/**
 * Parses a generic content source into a Document abstraction.
 *
 * Contract: the source must provide `body` as the raw document source.
 * The source may or may not include frontmatter; it is stripped here before
 * parsing headings. This keeps the rest of the codebase independent of the
 * underlying loader (glob, GitHub, CMS, etc.) and of file extensions like
 * `.md` or `.mdx`.
 */
export function parseDocument(source: DocumentSource): Document {
  const raw = stripFrontmatter(source.body ?? "");
  return {
    headings: extractHeadings(raw),
  };
}
