import type { ContentRepository, Document } from "../types";

/**
 * Adapter de ContentRepository que trabaja con un array de documentos en memoria.
 *
 * Útil para:
 * - Tests unitarios sin depender de Astro ni del filesystem.
 * - Prototipado rápido.
 * - Escenarios donde el contenido se genera dinámicamente en runtime.
 */
export class MemoryRepository implements ContentRepository {
  constructor(private documents: Document[]) {}

  async list(): Promise<Document[]> {
    return this.documents.filter((document) => !document.metadata.draft);
  }

  async get(id: string): Promise<Document | null> {
    const document = this.documents.find((document) => document.id === id);
    if (!document || document.metadata.draft) return null;
    return document;
  }

  async listChildren(parentId: string | null): Promise<Document[]> {
    return this.documents.filter(
      (document) =>
        document.parentId === parentId && !document.metadata.draft,
    );
  }
}
