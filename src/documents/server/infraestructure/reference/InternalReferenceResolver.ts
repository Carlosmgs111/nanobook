import type { ContentEntry } from "../../domain/types";
import type { DocumentReference } from "../../domain/DocumentReference";
import type { ReferenceResolutionContext, ReferenceResolver } from "../../domain/reference/types";
import type { ContentRepository } from "../../domain/ports/ContentRepository";

/**
 * Resolutor para referencias internas a otros documentos del mismo nanobook.
 *
 * Acepta strings que parecen rutas relativas: `./doc.md`, `../doc.md`, `sibling.md`.
 * No acepta rutas absolutas (`/README.md`) ni referencias estructuradas (GitHub, URL).
 */
export class InternalReferenceResolver implements ReferenceResolver {
  constructor(private readonly contentRepository: ContentRepository) {}

  async resolve(ref: DocumentReference, context: ReferenceResolutionContext): Promise<ContentEntry | null> {
    const refStr = ref.getValue();
    if (refStr.startsWith("/")) return null;
    const targetPath = context.sourcePath.resolveReference(refStr);
    if (!targetPath) return null;

    const target = await this.contentRepository.getByPublicPath(context.nanobookId, targetPath.getPublicValue());
    const targetDocument = target.isSuccess ? target.getValue() : null;
    if (!targetDocument) return null;

    return { data: targetDocument.getMetadata(), body: targetDocument.getContent() };
  }
}
