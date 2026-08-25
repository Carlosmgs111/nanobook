import type { ContentRepository, Document } from "../../model/types";

/**
 * Implementación en memoria de ContentRepository.
 *
 * Útil para tests y para desarrollo rápido sin depender del filesystem ni de
 * una colección de Astro.
 */
export class MemoryRepository implements ContentRepository {
  private documents: Map<string, Document>;

  constructor(documents: Document[] = []) {
    this.documents = new Map(documents.map((doc) => [doc.id, doc]));
  }

  async list(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async get(id: string): Promise<Document | null> {
    return this.documents.get(id) ?? null;
  }

  async listChildren(parentId: string | null): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.parentId === parentId,
    );
  }

  async save(document: Document): Promise<void> {
    this.documents.set(document.id, document);
  }
}
