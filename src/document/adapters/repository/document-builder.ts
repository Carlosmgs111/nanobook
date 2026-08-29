import { getParentId, normalizeDocumentId } from "../../parse/path";
import type { Document, DocumentMetadata } from "../../model/types";

const NEW_DOCUMENT_TEMPLATE = `---
title: "<%= title %>"
description: "<%= description %>"
date: <%= date %>
author: "<%= author %>"
tags: []
draft: false
index: <%= index %>
position: 0
---
`;

function interpolateTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/<%=\s*(\w+)\s*%>/g, (_, key) => values[key] ?? "");
}

export function buildNewDocument(
  id: string,
  overrides: Partial<DocumentMetadata> & { title: string; description: string }
): Document {
  const normalizedId = normalizeDocumentId(id);
  const now = new Date();
  const isIndex = id === "index" || id.endsWith("/index");
  const metadata = {
    title: overrides.title,
    description: overrides.description,
    date: overrides.date ?? now,
    author: overrides.author ?? "Nanobook",
    tags: overrides.tags ?? [],
    cover: overrides.cover,
    draft: overrides.draft ?? false,
    index: overrides.index ?? isIndex,
    position: overrides.position ?? 0,
    ref: overrides.ref,
  };

  if (metadata.index !== isIndex) {
    throw new Error(
      `Inconsistencia de índice: el id "${id}" ${
        isIndex ? "es" : "no es"
      } de índice pero metadata.index=${metadata.index}`
    );
  }

  const rawFrontmatter = interpolateTemplate(NEW_DOCUMENT_TEMPLATE, {
    title: metadata.title,
    description: metadata.description,
    date: metadata.date.toISOString(),
    author: metadata.author,
    index: String(metadata.index),
  });

  return buildDocument(normalizedId, metadata, "", rawFrontmatter);
}

export function assertRequiredField<T>(
  value: T | undefined,
  field: string,
  documentId: string
): T {
  if (value === undefined || value === null) {
    throw new Error(
      `Missing required field "${field}" in document "${documentId}"`
    );
  }
  return value;
}

export function toDocumentMetadata(
  data: Record<string, unknown>,
  documentId: string
): DocumentMetadata {
  return {
    title: assertRequiredField(data.title as string, "title", documentId),
    description: assertRequiredField(
      data.description as string,
      "description",
      documentId
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
  return match ? `---\n${match[1]}\n---\n` : "";
}

export function buildDocument(
  id: string,
  data: Record<string, unknown>,
  body: string,
  raw: string
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
