import type { Document, DocumentMetadata } from "../../../document/model/types";

export function createDocument(
  overrides: Partial<Document> & Partial<DocumentMetadata> = {},
): Document {
  const metadata: DocumentMetadata = {
    title: overrides.title ?? "Document",
    description: overrides.description ?? "Description",
    date: overrides.date ?? new Date("2024-01-01"),
    author: overrides.author ?? "Author",
    tags: overrides.tags ?? [],
    draft: overrides.draft ?? false,
    index: overrides.index ?? false,
    position: overrides.position ?? 0,
    cover: overrides.cover,
    ref: overrides.ref,
  };

  const id = overrides.id ?? "doc";
  const parentId =
    overrides.parentId !== undefined
      ? overrides.parentId
      : id === "index"
        ? null
        : "index";

  return {
    id,
    slug: overrides.slug ?? (id === "index" ? "" : id),
    parentId,
    position: overrides.position ?? 0,
    title: overrides.title ?? "Document",
    description: overrides.description ?? "Description",
    content: overrides.content ?? "",
    metadata,
    rawFrontmatter: "",
    proxyTargetId: overrides.proxyTargetId,
  };
}
