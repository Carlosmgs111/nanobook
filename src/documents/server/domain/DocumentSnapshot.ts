import { Document } from "./Document";
import type { DocumentMetadata } from "./types";
import type { DocumentParser } from "./ports/DocumentParser";

export interface DocumentSnapshot {
  id: string;
  revision: number;
  path: string;
  content: string;
  rawFrontmatter: string;
  metadata: Omit<DocumentMetadata, "createdAt" | "updatedAt"> & {
    createdAt: string;
    updatedAt: string;
  };
}

export function toDocumentSnapshot(document: Document): DocumentSnapshot {
  const metadata = document.getMetadata();
  return {
    id: document.getDocumentId().getValue(),
    revision: document.getRevision(),
    path: document.getPath(),
    content: document.getContent(),
    rawFrontmatter: document.getRawFrontmatter(),
    metadata: {
      ...metadata,
      createdAt: metadata.createdAt.toISOString(),
      updatedAt: metadata.updatedAt.toISOString(),
    },
  };
}

export function fromDocumentSnapshot(
  value: unknown,
  parser: DocumentParser,
): Document | null {
  if (!isDocumentSnapshot(value)) return null;
  if (value.metadata.id !== undefined && value.metadata.id !== value.id) return null;
  const createdAt = parseDate(value.metadata.createdAt);
  const updatedAt = parseDate(value.metadata.updatedAt);
  if (!createdAt || !updatedAt) return null;

  const result = Document.create(
    value.path,
    { ...value.metadata, createdAt, updatedAt },
    value.content,
    parser,
    value.rawFrontmatter,
    value.id,
    value.revision,
  );
  return result.isSuccess ? result.getValue() : null;
}

function isDocumentSnapshot(value: unknown): value is DocumentSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  if (
    typeof snapshot.id !== "string" ||
    !Number.isInteger(snapshot.revision) ||
    (snapshot.revision as number) < 1 ||
    typeof snapshot.path !== "string" ||
    typeof snapshot.content !== "string" ||
    typeof snapshot.rawFrontmatter !== "string" ||
    !snapshot.metadata ||
    typeof snapshot.metadata !== "object" ||
    Array.isArray(snapshot.metadata)
  ) return false;

  const metadata = snapshot.metadata as Record<string, unknown>;
  return (
    typeof metadata.title === "string" &&
    typeof metadata.description === "string" &&
    typeof metadata.createdAt === "string" &&
    typeof metadata.updatedAt === "string"
  );
}

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
