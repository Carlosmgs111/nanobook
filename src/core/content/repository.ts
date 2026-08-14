import {
  getCollection,
  render,
  type CollectionEntry,
} from "astro:content";
import type { ContentRepository, Document, DocumentMetadata } from "./types";

function getParentId(id: string): string | null {
  if (id === "index") return null;
  const lastSlash = id.lastIndexOf("/");
  return lastSlash === -1 ? "" : id.slice(0, lastSlash);
}

function toDocument(
  entry: CollectionEntry<"content">,
  position: number = 0,
): Document {
  const data = entry.data as DocumentMetadata;

  return {
    id: entry.id,
    slug: entry.id === "index" ? "" : entry.id,
    parentId: getParentId(entry.id),
    position,
    title: data.title,
    description: data.description,
    content: entry.body ?? "",
    metadata: data,
  };
}

/**
 * Cache a nivel de módulo. Astro carga este módulo una vez por proceso
 * de build, así que todas las instancias de AstroCollectionRepository
 * comparten la misma colección. Esto evita llamar repetidamente a
 * getCollection("content") y reconstruir el árbol de navegación para
 * cada página generada.
 */
let cachedDocuments: Document[] | null = null;
let cachedAstroEntries: Map<string, CollectionEntry<"content">> | null = null;

/**
 * Adapter que expone la colección de Astro como un ContentRepository.
 *
 * Es la implementación actual y la más simple: lee todo en build time
 * mediante getCollection("content"). En el futuro se pueden añadir
 * FileSystemRepository, DatabaseRepository, etc., sin tocar el resto
 * del dominio.
 *
 * Incluye render() porque Astro requiere la entrada original de su
 * colección para renderizar Markdown. El tipo Document del dominio no
 * sabe nada de Astro; el adapter mantiene el mapeo interno.
 */
export class AstroCollectionRepository implements ContentRepository {
  async list(): Promise<Document[]> {
    if (cachedDocuments) return cachedDocuments;

    const astroEntries = new Map<string, CollectionEntry<"content">>();
    const collection = await getCollection("content");

    cachedDocuments = collection
      .filter((entry) => !entry.data.draft)
      .map((entry, index) => {
        astroEntries.set(entry.id, entry);
        return toDocument(entry, index);
      });

    cachedAstroEntries = astroEntries;
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

  async render(document: Document): Promise<Awaited<ReturnType<typeof render>>> {
    if (!cachedAstroEntries) await this.list();

    const entry = cachedAstroEntries?.get(document.id);
    if (!entry) {
      throw new Error(`Cannot render document ${document.id}: Astro entry not found`);
    }

    return render(entry);
  }
}

export type { ContentRepository };
