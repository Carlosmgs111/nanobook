import type { ContentRepository } from "../_domain/types";
import type { CacheAdapter } from "./Cache.port";
import type { DocumentServiceError } from "../_domain/errors";
import { Document } from "../_domain/Document";
import type { Result } from "../../shared/utils/result";
import { ok, err } from "../../shared/utils/result";
import type { ParsePath } from "../_infraestructure/parse/parsePath";
import { buildNewDocument } from "../shared/utils/document-builder";
import {
  DocumentAlreadyExistsError,
  InvalidDocumentIdError,
  ParentNotFoundError,
} from "../_domain/errors";
import { DocumentId } from "../_domain/DocumentId";

export interface CreateDocumentInput {
  id: string;
  title: string;
  description: string;
  author?: string;
  date: Date;
  index: boolean;
  position?: number;
  draft?: boolean;
  tags?: string[];
}
export class CreateDocument {
  constructor(
    private repository: ContentRepository,
    private cache: CacheAdapter
  ) {}

  async execute(
    input: CreateDocumentInput
  ): Promise<Result<Document, DocumentServiceError>> {
    try {
      const id = new DocumentId(input.id);
      const isIndex = id.isIndexId();

      if (isIndex && input.index === false) {
        return err(new InvalidDocumentIdError(id));
      }

      const existing = await this.repository.get(id);
      if (existing) {
        return err(new DocumentAlreadyExistsError(id));
      }

      const parentId = id.getParentId();
      if (parentId !== null) {
        const parent = await this.repository.get(parentId);
        if (!parent) {
          return err(new ParentNotFoundError(parentId));
        }
        if (!parent.getMetadata().index) {
          return err(
            new InvalidDocumentIdError(parentId)
          );
        }
      }

      const document = Document.create(input.id, {
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
      await this.cache.invalidate([document.getId().getValue()]);
      if (parentId !== null) {
        await this.cache.invalidate([parentId.getValue()]);
      }

      return ok(document);
    } catch (error) {
      console.error(error);
      if (error instanceof InvalidDocumentIdError) {
        return err(error);
      }
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
