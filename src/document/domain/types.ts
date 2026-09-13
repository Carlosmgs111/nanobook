import type { Result } from "../../shared/utils/Result";
import type { DocumentId } from "./DocumentId";
import type { Document, Heading } from "./Document";
import type { Ref } from "./DocumentReference";
import type {
  DocumentRepositoryError,
  DocumentNotificationError,
  DocumentParseError,
} from "../infraestructure/errors";
import type {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  InvalidDocumentError,
  InvalidDocumentIdError,
} from "./errors";

export interface DocumentMetadata {
  title: string;
  description: string;
  date: Date;
  author?: string;
  cover?: string;
  tags?: string[];
  draft?: boolean | undefined;
  index: boolean;
  position?: number;
  ref?: Ref | string;
}

export interface ContentEntry {
  id: DocumentId;
  data: DocumentMetadata;
  body?: string;
  rawFrontmatter?: string;
}

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
  getById(id: string): Promise<Result<ContentRepositoryListError, Document | null>>;
  listChildren(parentId: string | null): Promise<Result<ContentRepositoryListError, Document[]>>;
  create(document: Document): Promise<Result<ContentRepositoryError, void>>;
  update(document: Document): Promise<Result<ContentRepositoryError, void>>;
}

/**
 * Puerto de notificación para efectos secundarios que deben ocurrir de forma
 * síncrona y confiable tras crear o actualizar un documento.
 *
 * El módulo `document` no conoce a los consumidores; `Application` cablea una
 * implementación concreta (por ejemplo, invalidación de caché de páginas).
 */
export interface DocumentChangeNotifier {
  onDocumentCreated(
    documentId: string
  ): Promise<Result<DocumentNotificationError, void>>;
  onDocumentUpdated(
    documentId: string
  ): Promise<Result<DocumentNotificationError, void>>;
}

export interface DocumentInput {
  id: string;
  title: string;
  description: string;
  author?: string;
  date: Date;
  index: boolean;
  position?: number;
  draft?: boolean;
  tags?: string[];
  content: string;

}


export interface Entry {
  id: string;
  title: string;
  description: string;
  position?: number;
  parentId?: string;  
  rawFrontmatter?: string;
  content?: string;
  slug?: string;
  headings: Heading[];
  metadata: {
    title: string;
    description: string;
    draft?: boolean;
    index: boolean;
    position?: number;
    art?: string;
    date: Date;
    author?: string;
  };
}