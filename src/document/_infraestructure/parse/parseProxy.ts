import type { Document, DocumentMetadata } from "../../_domain/types";
import type { ReferenceResolver } from "../../_domain/reference/types";
import { CompositeReferenceResolver } from "../../_domain/reference/resolver";
import { InternalReferenceResolver } from "../reference/InternalReferenceResolver";
import { LocalFileReferenceResolver } from "../reference/LocalFileReferenceResolver";
import { GitHubReferenceResolver } from "../reference/GitHubReferenceResolver";

export class ParseProxy {
  /**
   * Resuelve un documento proxy (con `ref` en frontmatter) reemplazando su
   * contenido y metadatos por los del documento destino, pero conservando su
   * propio id, slug y parentId para que se genere en su propia URL.
   *
   * Devuelve `null` si el documento no tiene `ref`, si no se encuentra el destino,
   * o si el destino también es un proxy (no se permiten cadenas).
   */
  parseProxy = async (
    sourceDocument: import("../../_domain/Document").Document,
    resolver: ReferenceResolver
  ): Promise<import("../../_domain/Document").Document | null> => {
    const data = sourceDocument.getMetadata();
    if (!data.ref) return null;

    try {
      const targetEntry = await resolver.resolve(data.ref, sourceDocument);

      if (!targetEntry) {
        console.warn(
          `Proxy reference not found: ${sourceDocument.getId().getValue()} -> ${JSON.stringify(
            data.ref
          )}`
        );
        return null;
      }

      const targetData = targetEntry.data as DocumentMetadata;

      if (targetData.ref) {
        console.warn(
          `Chained proxy references are not supported: ${sourceDocument
            .getId()
            .getValue()} -> ${JSON.stringify(data.ref)}`
        );
        return null;
      }

      const mergedData: DocumentMetadata = {
        ...data,
        ...targetData,
        position: data.position,
        index: data.index,
        ref: undefined,
      };

      return await (
        await import("../../_domain/Document")
      ).Document.create(sourceDocument.getId().getValue(), mergedData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Failed to resolve proxy ${sourceDocument.getId().getValue()}: ${message}`
      );
      return null;
    }
  };
  private createReferenceResolver = (
    documents: import("../../_domain/Document").Document[]
  ): ReferenceResolver => {
    const documentsById = new Map(
      documents.map((document) => [document.getId().getValue(), document])
    );

    return new CompositeReferenceResolver([
      new InternalReferenceResolver(documentsById),
      new LocalFileReferenceResolver(),
      new GitHubReferenceResolver(),
    ]);
  };

  parseProxies = async (
    documents: import("../../_domain/Document").Document[]
  ): Promise<import("../../_domain/Document").Document[]> => {
    const resolver = this.createReferenceResolver(documents);
    return Promise.all(
      documents.map(async (document) => {
        if (!document.getMetadata().ref) return document;
        return (await this.parseProxy(document, resolver)) ?? document;
      })
    );
  };
}
