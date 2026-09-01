import type { ContentRepository, Document } from "../../_domain/types";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
} from "../../_domain/errors";

/**
 * Implementación en memoria de ContentRepository.
 *
 * Útil para tests y para desarrollo rápido sin depender del filesystem ni de
 * una colección de Astro.
 */
export class InMemoryRepository implements ContentRepository {
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

  async create(document: Document): Promise<void> {
    if (this.documents.has(document.id)) {
      throw new DocumentAlreadyExistsError(document.id);
    }
    this.documents.set(document.id, document);
  }

  async update(document: Document): Promise<void> {
    if (!this.documents.has(document.id)) {
      throw new DocumentNotFoundError(document.id);
    }
    this.documents.set(document.id, document);
  }
}
