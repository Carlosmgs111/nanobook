import type { ContentRepository } from "../../domain/types";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
} from "../../domain/errors";
import { Document } from "../../domain/Document";
import { DocumentId } from "../../domain/DocumentId";

/**
 * Implementación en memoria de ContentRepository.
 *
 * Útil para tests y para desarrollo rápido sin depender del filesystem ni de
 * una colección de Astro.
 */
export class InMemoryRepository implements ContentRepository {
  private documents: Map<string, Document>;

  constructor(documents: Document[] = []) {
    this.documents = new Map(documents.map((doc) => [doc.getId().getValue(), doc]));
  }

  async list(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async get(id: DocumentId): Promise<Document | null> {
    return this.documents.get(id.getValue()) ?? null;
  }

  async getBySlug(slug: string): Promise<Document | null> {
    return this.documents.get(slug) ?? null;
  }

  async listChildren(parentId: string | null): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.getParentId() === parentId,
    );
  }

  async create(document: Document): Promise<void> {
    if (this.documents.has(document.getId().getValue())) {
      throw new DocumentAlreadyExistsError(document.getId());
    }
    this.documents.set(document.getId().getValue(), document);
  }

  async update(document: Document): Promise<void> {
    if (!this.documents.has(document.getId().getValue())) {
      throw new DocumentNotFoundError(document.getId());
    }
    this.documents.set(document.getId().getValue(), document);
  }
}
