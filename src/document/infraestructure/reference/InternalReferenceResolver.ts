import type { ContentEntry } from "../../domain/types";
import type { DocumentReference } from "../../domain/DocumentReference";
import type {
  ReferenceResolutionContext,
  ReferenceResolverPlugin,
} from "../../domain/reference/types";
import type { ContentRepository } from "../../domain/types";
import { DocumentId } from "../../domain/DocumentId";

/**
 * Resolutor para referencias internas a otros documentos de la colección.
 *
 * Acepta strings que parecen rutas relativas: `./doc.md`, `../doc.md`,
 * `sibling.md`. No acepta rutas absolutas (`/README.md`) ni prefijos como
 * `github:` o URLs.
 */
export class InternalReferenceResolver implements ReferenceResolverPlugin {
  name = "internal";

  constructor(private contentRepository: ContentRepository) {}

  async resolve(
    ref: DocumentReference,
    context: ReferenceResolutionContext
  ): Promise<ContentEntry | null> {
    const refStr = ref.getValue() as string;
    if (refStr.startsWith("/")) return null;
    const targetId = context.sourceId.resolveDocumentReference(refStr);
    const targetDocumentIdResult = DocumentId.create(targetId);
    if (!targetDocumentIdResult.isSuccess) return null;

    const targetDocumentResult = await this.contentRepository.getById(
      targetDocumentIdResult.getValue().getValue()
    );

    // console.log({ targetDocumentResult });

    if (!targetDocumentResult.isSuccess) return null;
    const targetDocument = targetDocumentResult.getValue();
    if (!targetDocument) return null;

    return {
      id: targetDocument.getId(),
      data: targetDocument.getMetadata(),
      body: targetDocument.getContent(),
      rawFrontmatter: targetDocument.getRawFrontmatter(),
    };
  }
}
