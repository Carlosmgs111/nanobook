import { getParentId } from "../../parse/path";
import type { Document, DocumentMetadata } from "../../model/types";

export function assertRequiredField<T>(
  value: T | undefined,
  field: string,
  documentId: string,
): T {
  if (value === undefined || value === null) {
    throw new Error(
      `Missing required field "${field}" in document "${documentId}"`,
    );
  }
  return value;
}

export function toDocumentMetadata(
  data: Record<string, unknown>,
  documentId: string,
): DocumentMetadata {
  return {
    title: assertRequiredField(data.title as string, "title", documentId),
    description: assertRequiredField(
      data.description as string,
      "description",
      documentId,
    ),
    date: assertRequiredField(data.date as Date, "date", documentId),
    author: assertRequiredField(data.author as string, "author", documentId),
    tags: (data.tags as string[]) ?? [],
    cover: data.cover as string | undefined,
    draft: (data.draft as boolean) ?? false,
    index: (data.index as boolean) ?? false,
    position: (data.position as number) ?? 0,
    ref: data.ref as DocumentMetadata["ref"],
  };
}

export function extractFrontmatter(raw: string): string {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return match ? `---\n${match[1]}---\n\n` : "";
}

export function buildDocument(
  id: string,
  data: Record<string, unknown>,
  body: string,
  raw: string,
): Document {
  const metadata = toDocumentMetadata(data, id);

  return {
    id,
    slug: id === "index" ? "" : id,
    parentId: getParentId(id),
    position: metadata.position,
    title: metadata.title,
    description: metadata.description,
    content: body,
    metadata,
    rawFrontmatter: extractFrontmatter(raw),
  };
}
