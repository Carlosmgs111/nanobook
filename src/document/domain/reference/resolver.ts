import type { ContentEntry } from "../types";
import type {
  ReferenceResolutionContext,
  ReferenceResolver,
  ReferenceResolverPlugin,
} from "./types";
import type { Document } from "../Document";
import { DocumentReference } from "../DocumentReference";

/**
 * Servicio que intenta resolver un `ref` usando una lista de plugins.
 *
 * El orden por defecto es:
 * 1. Referencias internas a la colección (relativas).
 * 2. Archivos locales del proyecto (`/README.md`).
 * 3. Plugins adicionales registrados por el adaptador (ej. GitHub).
 */
export class CompositeReferenceResolver implements ReferenceResolver {
  constructor(private plugins: ReferenceResolverPlugin[]) {}

  async resolve(
    ref: DocumentReference,
    sourceDocument: Document
  ): Promise<ContentEntry | null> {
    const context: ReferenceResolutionContext = {
      sourceId: sourceDocument.getId(),
      sourceData: sourceDocument.getMetadata(),
    };

    for (const plugin of this.plugins) {
      const result = await plugin.resolve(ref, context);
      // console.log(result);

      if (result) return result;
    }

    console.warn(
      `No resolver found for reference ${JSON.stringify(
        ref
      )} in ${sourceDocument.getId().getValue()}`
    );
    return null;
  }
}
