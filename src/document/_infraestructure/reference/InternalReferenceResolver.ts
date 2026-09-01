import type { ContentEntry, Document, RefValue } from "../../_domain/types";
import type {
  ReferenceResolutionContext,
  ReferenceResolverPlugin,
} from "../../_domain/reference/types";
import { resolveDocumentReference } from "../../_domain/reference/path-resolver";

/**
 * Resolutor para referencias internas a otros documentos de la colección.
 *
 * Acepta strings que parecen rutas relativas: `./doc.md`, `../doc.md`,
 * `sibling.md`. No acepta rutas absolutas (`/README.md`) ni prefijos como
 * `github:` o URLs.
 */
export class InternalReferenceResolver implements ReferenceResolverPlugin {
  name = "internal";

  constructor(
    private documentsById: Map<
      string,
      import("../../_domain/Document").Document
    >
  ) {}

  canResolve(ref: RefValue): boolean {
    return (
      typeof ref === "string" && !ref.startsWith("/") && !ref.includes(":")
    );
  }

  async resolve(
    ref: RefValue,
    context: ReferenceResolutionContext
  ): Promise<ContentEntry | null> {
    const refStr = ref as string;
    const targetId = resolveDocumentReference(
      refStr,
      context.sourceId,
      context.sourceData.index
    );
    const targetDocument = this.documentsById.get(targetId);

    if (!targetDocument) return null;

    return {
      id: targetDocument.getId().getValue(),
      data: targetDocument.getMetadata(),
      body: targetDocument.getContent(),
      rawFrontmatter: targetDocument.getRawFrontmatter(),
    };
  }
}
