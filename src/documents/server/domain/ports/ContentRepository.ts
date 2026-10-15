import type { Result } from "../../../../shared/domain/Result";
import type { Document } from "../Document";
import type {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  InvalidDocumentError,
  InvalidDocumentIdError,
  DocumentRepositoryError,
  DocumentParseError,
  DocumentRevisionConflictError,
} from "../errors";

export type ContentRepositoryListError =
  | DocumentRepositoryError
  | DocumentParseError
  | InvalidDocumentError
  | InvalidDocumentIdError;

export type ContentRepositoryError =
  | DocumentRepositoryError
  | DocumentAlreadyExistsError
  | DocumentNotFoundError
  | DocumentRevisionConflictError;

export interface ContentRepository {
  list(nanobookId: string): Promise<Result<ContentRepositoryListError, Document[]>>;
  getById(
    nanobookId: string,
    id: string
  ): Promise<Result<ContentRepositoryListError, Document | null>>;
  getByPath(
    nanobookId: string,
    path: string
  ): Promise<Result<ContentRepositoryListError, Document | null>>;
  getByPublicPath(
    nanobookId: string,
    path: string
  ): Promise<Result<ContentRepositoryListError, Document | null>>;
  listChildren(
    nanobookId: string,
    parentPath: string | null
  ): Promise<Result<ContentRepositoryListError, Document[]>>;
  create(nanobookId: string, document: Document): Promise<Result<ContentRepositoryError, void>>;
  update(
    nanobookId: string,
    document: Document,
    previousPath?: string
  ): Promise<Result<ContentRepositoryError, void>>;
  updateWithRevision?(
    nanobookId: string,
    document: Document,
    expectedRevision: number,
    previousPath?: string,
  ): Promise<Result<ContentRepositoryError, void>>;
  updateMany?(
    nanobookId: string,
    updates: Array<{ document: Document; previousPath?: string; expectedRevision?: number }>,
  ): Promise<Result<ContentRepositoryError, void>>;
  delete(nanobookId: string, document: Document): Promise<Result<ContentRepositoryError, void>>;
  deleteMany?(nanobookId: string, documents: Document[]): Promise<Result<ContentRepositoryError, void>>;
  clearCache?(nanobookId: string): Promise<void> | void;
}
