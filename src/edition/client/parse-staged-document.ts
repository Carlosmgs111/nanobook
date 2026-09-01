import { parse } from "yaml";
import type { Document } from "../../document/_domain/types";

export function buildDocumentFromContent(
  base: Document,
  fullContent: string
): Document {
  const rawFrontmatter = fullContent.match(/^---[\s\S]*?---\n?/)?.[0]!;
  const data = parse(rawFrontmatter.replaceAll("---", ""))!;
  const content = fullContent.replace(/^---[\s\S]*?---\n?/g, "");
  return {
    ...base,
    metadata: data,
    content,
    rawFrontmatter,
  };
}
