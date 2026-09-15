import { parse } from "yaml";
import type {
  SerializedEntry,
  SerializedDocumentMetadata,
} from "../../document/application/dto/SerializedEntry";

export function buildDocumentFromContent(
  base: SerializedEntry,
  fullContent: string
): SerializedEntry {
  const rawFrontmatter = fullContent.match(/^---[\s\S]*?---\n?/)?.[0] ?? "";
  const data = (parse(rawFrontmatter.replaceAll("---", "")) ?? {}) as Partial<
    SerializedDocumentMetadata
  >;
  const content = fullContent.replace(/^---[\s\S]*?---\n?/g, "");

  const date: string =
    data.date instanceof Date
      ? data.date.toISOString()
      : data.date ?? base.metadata.date;

  return {
    ...base,
    metadata: {
      ...base.metadata,
      ...data,
      date,
    },
    content,
    rawFrontmatter,
  };
}
