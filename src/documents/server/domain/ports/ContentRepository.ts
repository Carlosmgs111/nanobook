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
  list(): Promise<Result<ContentRepositoryListError, Document[]>>;
  getById(
    id: string
  ): Promise<Result<ContentRepositoryListError, Document | null>>;
  getByPath(
    path: string
  ): Promise<Result<ContentRepositoryListError, Document | null>>;
  getByPublicPath(
    path: string
  ): Promise<Result<ContentRepositoryListError, Document | null>>;
  listChildren(
    parentPath: string | null
  ): Promise<Result<ContentRepositoryListError, Document[]>>;
  create(document: Document): Promise<Result<ContentRepositoryError, void>>;
  update(
    document: Document,
    previousPath?: string
  ): Promise<Result<ContentRepositoryError, void>>;
  updateWithRevision?(
    document: Document,
    expectedRevision: number,
    previousPath?: string,
  ): Promise<Result<ContentRepositoryError, void>>;
  delete(document: Document): Promise<Result<ContentRepositoryError, void>>;
  clearCache?(): Promise<void> | void;
}
