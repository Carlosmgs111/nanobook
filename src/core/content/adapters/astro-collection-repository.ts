import type { CollectionEntry } from "astro:content";
import { getAstroEntries } from "../astro-cache";
import type { ContentRepository, Document, DocumentMetadata } from "../types";

function getParentId(id: string): string | null {
  if (id === "index") return null;
  const lastSlash = id.lastIndexOf("/");
  return lastSlash === -1 ? "" : id.slice(0, lastSlash);
}

function toDocument(entry: CollectionEntry<"content">): Document {
  const data = entry.data as DocumentMetadata;

  return {
    id: entry.id,
    slug: entry.id === "index" ? "" : entry.id,
    parentId: getParentId(entry.id),
    position: data.position,
    title: data.title,
    description: data.description,
    content: entry.body ?? "",
    metadata: data,
  };
}

/**
 * Cache a nivel de módulo de documentos del dominio. Astro carga este
 * módulo una vez por proceso de build, así que todas las instancias de
 * AstroCollectionRepository comparten la misma lista. Esto evita
 * reconstruir los documentos y el árbol de navegación para cada página
 * generada.
 */
let cachedDocuments: Document[] | null = null;

/**
 * Adapter que expone la colección de Astro como un ContentRepository.
 *
 * Es la implementación actual y la más simple: lee todo en build time
 * mediante las entradas de Astro. En el futuro se pueden añadir
 * FileSystemRepository, DatabaseRepository, etc., sin tocar el resto
 * del dominio.
 *
 * Responsabilidad única: gestionar la persistencia/lectura de documentos.
 * El renderizado es responsabilidad de DocumentRenderer.
 */
export class AstroCollectionRepository implements ContentRepository {
  async list(): Promise<Document[]> {
    if (cachedDocuments) return cachedDocuments;

    const entries = await getAstroEntries();

    cachedDocuments = Array.from(entries.values())
      .filter((entry) => !entry.data.draft)
      .map((entry) => toDocument(entry));

    return cachedDocuments;
  }

  async get(id: string): Promise<Document | null> {
    const entries = await this.list();
    return entries.find((entry) => entry.id === id) ?? null;
  }

  async listChildren(parentId: string | null): Promise<Document[]> {
    const entries = await this.list();
    return entries.filter((entry) => entry.parentId === parentId);
  }
}

export type { ContentRepository };
