import type { APIRoute } from "astro";
import { createContentRepository } from "../adapters/repository/factory";
import { buildNewDocument } from "../adapters/repository/document-builder";
import {
  getParentId,
  isIndexId,
  normalizeDocumentId,
  validateDocumentId,
} from "../parse/path";
import type { ContentRepository, Document } from "../model/types";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  InvalidDocumentIdError,
  ParentNotFoundError,
} from "../model/errors";
import { createRenderedPageCache } from "../../rendering/adapters/cache/factory";

export const prerender = false;

export interface CreateDocumentPayload {
  id: string;
  title: string;
  description: string;
  author?: string;
  date?: string;
  index?: boolean;
  position?: number;
  draft?: boolean;
  tags?: string[];
}

export function createPatchHandler(
  repository: ContentRepository,
): APIRoute {
  return async ({ params, request }) => {
    try {
      const { slug } = params;
      if (!slug) {
        return jsonResponse({ error: "Falta el parámetro slug" }, 400);
      }

      const document: Document = JSON.parse(await request.text());

      if (document.id !== slug) {
        return jsonResponse(
          { error: "El slug no coincide con el id del documento" },
          400,
        );
      }

      await repository.update(document);
      await invalidateRenderedCache(document.id);

      return jsonResponse({ ok: true }, 200);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

export function createPostHandler(
  repository: ContentRepository,
): APIRoute {
  return async ({ request }) => {
    try {
      const rawPayload = (await request.json()) as CreateDocumentPayload;
      const isIndex = isIndexId(rawPayload.id);
      const payload: CreateDocumentPayload = {
        ...rawPayload,
        id: normalizeDocumentId(rawPayload.id),
        index: rawPayload.index ?? isIndex,
      };

      validateDocumentId(payload.id);

      if (isIndex && payload.index === false) {
        return jsonResponse(
          {
            error: `El id "${payload.id}" es de índice, no se puede forzar index: false`,
          },
          400,
        );
      }

      const existing = await repository.get(payload.id);
      if (existing) {
        throw new DocumentAlreadyExistsError(payload.id);
      }

      const parentId = getParentId(payload.id);
      if (parentId !== null) {
        const parent = await repository.get(parentId);
        if (!parent) {
          throw new ParentNotFoundError(parentId);
        }
        if (!parent.metadata.index) {
          return jsonResponse(
            { error: `El padre "${parentId}" no es un índice` },
            400,
          );
        }
      }

      const document = buildNewDocument(payload.id, {
        title: payload.title,
        description: payload.description,
        author: payload.author,
        date: payload.date ? new Date(payload.date) : undefined,
        index: payload.index,
        position: payload.position,
        draft: payload.draft,
        tags: payload.tags,
      });

      await repository.create(document);
      await invalidateRenderedCache(document.id);
      if (parentId !== null) {
        await invalidateRenderedCache(parentId);
      }

      return jsonResponse(document, 201);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

export const PATCH: APIRoute = async (context) => {
  const repository = await createContentRepository();
  return createPatchHandler(repository)(context);
};

export const POST: APIRoute = async (context) => {
  const repository = await createContentRepository();
  return createPostHandler(repository)(context);
};

async function invalidateRenderedCache(documentId: string): Promise<void> {
  try {
    const cache = createRenderedPageCache();
    await cache.invalidate([documentId]);
  } catch {
    // El cache es opcional; no debe fallar la operación de escritura.
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function handleApiError(error: unknown): Response {
  if (error instanceof InvalidDocumentIdError) {
    return jsonResponse({ error: error.message }, 400);
  }

  if (error instanceof DocumentNotFoundError) {
    return jsonResponse({ error: error.message }, 404);
  }

  if (error instanceof DocumentAlreadyExistsError) {
    return jsonResponse({ error: error.message }, 409);
  }

  if (error instanceof ParentNotFoundError) {
    return jsonResponse({ error: error.message }, 400);
  }

  console.error(error);
  return jsonResponse({ error: "Error interno del servidor" }, 500);
}
