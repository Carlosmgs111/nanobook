import type { Document, DocumentMetadata, RefValue } from "../model/types";
import type {
  ReferenceResolutionContext,
  ReferenceResolver,
  ReferenceResolverPlugin,
} from "./types";

export interface ReferenceResolverOptions {
  projectRoot?: string;
  githubToken?: string;
  readFile(path: string): Promise<string>;
}

/**
 * Servicio que intenta resolver un `ref` usando una lista de plugins.
 *
 * El orden por defecto es:
 * 1. Referencias internas a la colección (relativas).
 * 2. Archivos locales del proyecto (`/README.md`).
 * 3. Plugins adicionales registrados por el adaptador (ej. GitHub).
 */
export class CompositeReferenceResolver implements ReferenceResolver {
  constructor(
    private plugins: ReferenceResolverPlugin[],
    private options: ReferenceResolverOptions,
  ) {}

  async resolve(
    ref: RefValue,
    sourceDocument: Document,
  ): Promise<import("../model/types").ContentEntry | null> {
    const context: ReferenceResolutionContext = {
      sourceId: sourceDocument.id,
      sourceData: sourceDocument.metadata,
      projectRoot: this.options.projectRoot ?? process.cwd(),
      readFile: this.options.readFile,
      githubToken: this.options.githubToken,
    };

    for (const plugin of this.plugins) {
      if (plugin.canResolve(ref)) {
        return await plugin.resolve(ref, context);
      }
    }

    console.warn(
      `No resolver found for reference ${JSON.stringify(ref)} in ${sourceDocument.id}`,
    );
    return null;
  }
}
