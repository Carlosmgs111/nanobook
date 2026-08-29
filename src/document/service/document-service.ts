import type { Result } from "../../shared/utils/result";
import { ok, err } from "../../shared/utils/result";
import { buildNewDocument } from "../adapters/utils/document-builder";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  InvalidDocumentIdError,
  ParentNotFoundError,
} from "../model/errors";
import type { ContentRepository, Document } from "../model/types";
import {
  getParentId,
  isIndexId,
  normalizeDocumentId,
  validateDocumentId,
} from "../parse/path";
import type { RenderedPageCache } from "../../rendering/model/types";

export type DocumentServiceError =
  | DocumentAlreadyExistsError
  | DocumentNotFoundError
  | InvalidDocumentIdError
  | ParentNotFoundError
  | Error;

export interface CreateDocumentInput {
  id: string;
  title: string;
  description: string;
  author?: string;
  date?: Date;
  index?: boolean;
  position?: number;
  draft?: boolean;
  tags?: string[];
}

export class DocumentService {
  constructor(
    private readonly repository: ContentRepository,
    private readonly cache?: RenderedPageCache,
  ) {}

  async create(
    input: CreateDocumentInput,
  ): Promise<Result<Document, DocumentServiceError>> {
    try {
      const isIndex = isIndexId(input.id);
      validateDocumentId(input.id);

      if (isIndex && input.index === false) {
        return err(
          new InvalidDocumentIdError(
            `El id "${input.id}" es de índice, no se puede forzar index: false`,
          ),
        );
      }

      const normalizedId = normalizeDocumentId(input.id);
      const existing = await this.repository.get(normalizedId);
      if (existing) {
        return err(new DocumentAlreadyExistsError(normalizedId));
      }

      const parentId = getParentId(input.id);
      if (parentId !== null) {
        const parent = await this.repository.get(parentId);
        if (!parent) {
          return err(new ParentNotFoundError(parentId));
        }
        if (!parent.metadata.index) {
          return err(
            new InvalidDocumentIdError(
              `El padre "${parentId}" no es un índice`,
            ),
          );
        }
      }

      const document = buildNewDocument(input.id, {
        title: input.title,
        description: input.description,
        author: input.author,
        date: input.date,
        index: input.index,
        position: input.position,
        draft: input.draft,
        tags: input.tags,
      });

      await this.repository.create(document);
      await this.invalidateCache(document.id);
      if (parentId !== null) {
        await this.invalidateCache(parentId);
      }

      return ok(document);
    } catch (error) {
      if (error instanceof InvalidDocumentIdError) {
        return err(error);
      }
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async update(
    document: Document,
  ): Promise<Result<void, DocumentServiceError>> {
    try {
      await this.repository.update(document);
      await this.invalidateCache(document.id);
      return ok(undefined);
    } catch (error) {
      if (error instanceof DocumentNotFoundError) {
        return err(error);
      }
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async invalidateCache(documentId: string): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.invalidate([documentId]);
    } catch {
      // El cache es opcional; no debe fallar la operación de escritura.
    }
  }
}
