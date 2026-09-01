import { createHash } from "node:crypto";
import type { Document, DocumentHash } from "./types";

function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function serializeMetadata(document: Document): string {
  const { metadata } = document;
  return JSON.stringify({
    title: metadata.title,
    description: metadata.description,
    position: metadata.position,
    draft: metadata.draft,
    index: metadata.index,
    ref: metadata.ref,
    cover: metadata.cover,
    tags: metadata.tags,
    author: metadata.author,
    date: metadata.date?.toISOString(),
  });
}

/**
 * Calcula los hashes de contenido y metadatos de un documento.
 *
 * Esta función es pura y no depende de snapshot ni de I/O; por eso vive en
 * el modelo en lugar de en el módulo de cambios.
 */
export function hashDocument(document: Document): DocumentHash {
  return {
    id: document.id,
    contentHash: hashString(document.content),
    metadataHash: hashString(serializeMetadata(document)),
  };
}

/**
 * Calcula solo el hash de contenido de un documento.
 */
export function computeContentHash(document: Document): string {
  return hashString(document.content);
}
