import { toString } from "mdast-util-to-string";
import { slug } from "github-slugger";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Node } from "unist";
import type { DocumentParser as DocumentParserPort } from "../../domain/DocumentParser";
import type { Document, Heading } from "../../domain/Document";
import { FrontmatterParser } from "./FrontmatterParser";

export class UnifiedDocumentParser implements DocumentParserPort {
  parseFrontmatter = FrontmatterParser.parseFrontmatter;

  private stripFrontmatter(source: string): string {
    return source.replace(/^---[\s\S]*?---\n?/, "");
  }

  private extractHeadings(source: string): Heading[] {
    const tree = unified().use(remarkParse).parse(source);
    const headings: Heading[] = [];

    const visit = (node: Node) => {
      const anyNode = node as any;
      if (
        anyNode.type === "heading" &&
        anyNode.depth >= 2 &&
        anyNode.depth <= 3
      ) {
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

  parseDocument(document: Document): { headings: Heading[] } {
    const raw = this.stripFrontmatter(document.getContent() ?? "");
    return {
      headings: this.extractHeadings(raw),
    };
  }
}
