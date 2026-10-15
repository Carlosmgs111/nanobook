import { Result } from "../../../../shared/domain/Result";
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

/** Implementación en memoria de ContentRepository, aislada por nanobookId. */
export class InMemoryRepository implements ContentRepository {
  private readonly documents = new Map<string, Map<string, Document>>();

  constructor(documents: Document[] = []) {
    this.documents.set(
      "default",
      new Map(documents.map((doc) => [doc.getDocumentId().getValue(), doc])),
    );
  }

  async list(nanobookId: string): Promise<Result<ContentRepositoryListError, Document[]>> {
    return Result.ok(Array.from(this.documents.get(nanobookId)?.values() ?? []));
  }

  async getById(
    nanobookId: string,
    id: string,
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    return Result.ok(this.documents.get(nanobookId)?.get(id) ?? null);
  }

  async getByPath(
    nanobookId: string,
    path: string,
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    return Result.ok(
      Array.from(this.documents.get(nanobookId)?.values() ?? []).find(
        (document) => document.getPath() === path,
      ) ?? null,
    );
  }

  async getByPublicPath(
    nanobookId: string,
    path: string,
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    return Result.ok(
      Array.from(this.documents.get(nanobookId)?.values() ?? []).find(
        (document) => document.getPublicPath() === path,
      ) ?? null,
    );
  }

  async listChildren(
    nanobookId: string,
    parentPath: string | null,
  ): Promise<Result<ContentRepositoryListError, Document[]>> {
    return Result.ok(
      Array.from(this.documents.get(nanobookId)?.values() ?? []).filter(
        (document) => document.getParentPath()?.getPublicValue() === parentPath,
      ),
    );
  }

  async create(
    nanobookId: string,
    document: Document,
  ): Promise<Result<DocumentRepositoryError | DocumentAlreadyExistsError, void>> {
    const documents = this.getBucket(nanobookId);
    const id = document.getDocumentId().getValue();
    if (documents.has(id)) return Result.fail(new DocumentAlreadyExistsError(id));
    documents.set(id, document);
    return Result.ok();
  }

  async update(
    nanobookId: string,
    document: Document,
    _previousPath?: string,
  ): Promise<
    Result<DocumentRepositoryError | DocumentNotFoundError | DocumentAlreadyExistsError, void>
  > {
    const documents = this.getBucket(nanobookId);
    const documentId = document.getDocumentId().getValue();
    if (!documents.has(documentId)) {
      return Result.fail(new DocumentNotFoundError(document.getDocumentId().getValue()));
    }
    const collision = Array.from(documents.values()).some(
      (candidate) =>
        candidate.getDocumentId().getValue() !== documentId &&
        candidate.getPath() === document.getPath(),
    );
    if (collision) return Result.fail(new DocumentAlreadyExistsError(document.getPath()));
    documents.set(documentId, document);
    return Result.ok();
  }

  async delete(
    nanobookId: string,
    document: Document,
  ): Promise<Result<DocumentRepositoryError | DocumentNotFoundError, void>> {
    const documents = this.getBucket(nanobookId);
    const key = document.getDocumentId().getValue();
    if (!documents.has(key)) return Result.fail(new DocumentNotFoundError(document.getPath()));
    documents.delete(key);
    return Result.ok();
  }

  private getBucket(nanobookId: string): Map<string, Document> {
    const documents = this.documents.get(nanobookId) ?? new Map<string, Document>();
    this.documents.set(nanobookId, documents);
    return documents;
  }
}
