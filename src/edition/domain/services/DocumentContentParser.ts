import { parse } from "yaml";
import type {
  SerializedEntry,
  SerializedDocumentMetadata,
} from "../model/StagedDocument";
import { InvalidDocumentContentError } from "../errors";

export function buildDocumentFromContent(
  base: SerializedEntry,
  fullContent: string
): SerializedEntry {
  const frontmatterMatch = fullContent.match(/^---[\s\S]*?---\n?/);
  const rawFrontmatter = frontmatterMatch?.[0] ?? "";
  const frontmatterBody = rawFrontmatter.replaceAll("---", "");

  let data: Partial<SerializedDocumentMetadata>;
  try {
    data = (parse(frontmatterBody) ?? {}) as Partial<SerializedDocumentMetadata>;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new InvalidDocumentContentError(reason);
  }

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
