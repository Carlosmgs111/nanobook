import { Result } from "../../../shared/domain/Result";
import type {
  ContentRepository,
  ContentRepositoryListError,
} from "../../domain/ports/ContentRepository";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  DocumentRepositoryError,
} from "../../domain/errors";
import { Document } from "../../domain/Document";

/**
 * Implementación en memoria de ContentRepository.
 *
 * Útil para tests y para desarrollo rápido sin depender del filesystem ni de
 * una colección de Astro.
 */
export class InMemoryRepository implements ContentRepository {
  private documents: Map<string, Document>;

  constructor(documents: Document[] = []) {
    this.documents = new Map(documents.map((doc) => [doc.getDocumentId().getValue(), doc]));
  }

  async list(): Promise<Result<ContentRepositoryListError, Document[]>> {
    return Result.ok(Array.from(this.documents.values()));
  }

  async getById(
    id: string
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    return Result.ok(
      Array.from(this.documents.values()).find(
        (document) => document.getDocumentId().getValue() === id
      ) ?? null
    );
  }

  async getByPath(
    path: string
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    return Result.ok(
      Array.from(this.documents.values()).find((document) => document.getPath() === path) ?? null
    );
  }

  async listChildren(
    parentId: string | null
  ): Promise<Result<ContentRepositoryListError, Document[]>> {
    return Result.ok(
      Array.from(this.documents.values()).filter(
        (doc) => doc.getParentPath()?.getValue() === parentId
      )
    );
  }

  async create(
    document: Document
  ): Promise<Result<DocumentRepositoryError | DocumentAlreadyExistsError, void>> {
    if (this.documents.has(document.getDocumentId().getValue())) {
      return Result.fail(new DocumentAlreadyExistsError(document.getDocumentId().getValue()));
    }
    this.documents.set(document.getDocumentId().getValue(), document);
    return Result.ok();
  }

  async update(
    document: Document
  ): Promise<Result<DocumentRepositoryError | DocumentNotFoundError, void>> {
    if (!this.documents.has(document.getDocumentId().getValue())) {
      return Result.fail(new DocumentNotFoundError(document.getDocumentId().getValue()));
    }
    this.documents.set(document.getDocumentId().getValue(), document);
    return Result.ok();
  }
}
