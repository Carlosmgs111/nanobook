import type { Result } from "../../../shared/domain/Result";
import type { Document } from "../Document";
import type {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  InvalidDocumentError,
  InvalidDocumentIdError,
  DocumentRepositoryError,
  DocumentParseError,
} from "../errors";

export type ContentRepositoryListError =
  | DocumentRepositoryError
  | DocumentParseError
  | InvalidDocumentError
  | InvalidDocumentIdError;

export type ContentRepositoryError =
  | DocumentRepositoryError
  | DocumentAlreadyExistsError
  | DocumentNotFoundError;

export interface ContentRepository {
  list(): Promise<Result<ContentRepositoryListError, Document[]>>;
  getById(
    id: string
  ): Promise<Result<ContentRepositoryListError, Document | null>>;
  listChildren(
    parentId: string | null
  ): Promise<Result<ContentRepositoryListError, Document[]>>;
  create(document: Document): Promise<Result<ContentRepositoryError, void>>;
  update(document: Document): Promise<Result<ContentRepositoryError, void>>;
}
