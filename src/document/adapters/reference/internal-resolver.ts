import type {
  ContentEntry,
  Document,
  RefValue,
} from "../../model/types";
import type { ReferenceResolutionContext, ReferenceResolverPlugin } from "../../reference/types";
import { resolveDocumentReference } from "../../reference/path-resolver";

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
    private documentsById: Map<string, Document>,
  ) {}

  canResolve(ref: RefValue): boolean {
    return (
      typeof ref === "string" &&
      !ref.startsWith("/") &&
      !ref.includes(":")
    );
  }

  async resolve(
    ref: RefValue,
    context: ReferenceResolutionContext,
  ): Promise<ContentEntry | null> {
    const refStr = ref as string;
    const targetId = resolveDocumentReference(
      refStr,
      context.sourceId,
      context.sourceData.index,
    );
    const targetDocument = this.documentsById.get(targetId);

    if (!targetDocument) return null;

    return {
      id: targetDocument.id,
      data: targetDocument.metadata,
      body: targetDocument.content,
      rawFrontmatter: targetDocument.rawFrontmatter,
    };
  }
}
