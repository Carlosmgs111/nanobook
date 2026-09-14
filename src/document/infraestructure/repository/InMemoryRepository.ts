import { Result } from "../../../shared/domain/Result";
import type {
  ContentRepository,
  ContentRepositoryListError,
} from "../../domain/types";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
} from "../../domain/errors";
import { Document } from "../../domain/Document";
import { DocumentId } from "../../domain/DocumentId";
import { DocumentRepositoryError } from "../errors";

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

  async list(): Promise<Result<ContentRepositoryListError, Document[]>> {
    return Result.ok(Array.from(this.documents.values()));
  }

  async getById(
    id: string
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    return Result.ok(this.documents.get(id) ?? null);
  }

  async listChildren(
    parentId: string | null
  ): Promise<Result<ContentRepositoryListError, Document[]>> {
    return Result.ok(
      Array.from(this.documents.values()).filter(
        (doc) => doc.getParentId() === parentId
      )
    );
  }

  async create(
    document: Document
  ): Promise<Result<DocumentRepositoryError | DocumentAlreadyExistsError, void>> {
    if (this.documents.has(document.getId().getValue())) {
      return Result.fail(new DocumentAlreadyExistsError(document.getId().getValue()));
    }
    this.documents.set(document.getId().getValue(), document);
    return Result.ok();
  }

  async update(
    document: Document
  ): Promise<Result<DocumentRepositoryError | DocumentNotFoundError, void>> {
    if (!this.documents.has(document.getId().getValue())) {
      return Result.fail(new DocumentNotFoundError(document.getId().getValue()));
    }
    this.documents.set(document.getId().getValue(), document);
    return Result.ok();
  }
}
