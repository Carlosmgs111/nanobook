import { Document } from "../domain/Document";
import { DocumentReference } from "../domain/DocumentReference";
import type { ReferenceResolver } from "../domain/reference/types";

/**
 * Sustituye el contenido de los documentos con `ref` por el del destino.
 *
 * El resultado conserva posición, dueño, marca de nanobook y `ref` del origen, y hereda del destino
 * todo lo demás, incluida la marca `secured`: así un atajo nunca expone un destino protegido.
 * Si el `ref` no se resuelve (o encadena otro `ref`), el documento se devuelve tal cual.
 */
export class ProxyParser {
  /** Los resolutores se prueban en orden; gana el primero que devuelva contenido. */
  constructor(private readonly resolvers: ReferenceResolver[]) {}

  parseProxies(nanobookId: string, documents: Document[]): Promise<Document[]> {
    return Promise.all(documents.map((document) => this.parseProxy(nanobookId, document)));
  }

  private async parseProxy(nanobookId: string, source: Document): Promise<Document> {
    const data = source.getMetadata();
    if (!data.ref) return source;

    const label = `${source.getPath()} -> ${JSON.stringify(data.ref)}`;
    try {
      const target = await this.resolve(new DocumentReference(data.ref), nanobookId, source);
      if (!target) {
        console.warn(`Proxy reference not found: ${label}`);
        return source;
      }
      if (target.data.ref) {
        console.warn(`Chained proxy references are not supported: ${label}`);
        return source;
      }

      const merged = Document.create(
        source.getPath(),
        {
          ...data,
          ...target.data,
          position: data.position,
          ownerId: data.ownerId,
          nanobook: data.nanobook,
          ref: data.ref,
        },
        target.body,
      );
      if (merged.isSuccess) return merged.getValue();
      console.warn(`Failed to create proxy document ${label}: ${merged.getError().message}`);
    } catch (error) {
      console.warn(`Failed to resolve proxy ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return source;
  }

  private async resolve(ref: DocumentReference, nanobookId: string, source: Document) {
    const context = { nanobookId, sourcePath: source.getDocumentPath() };
    for (const resolver of this.resolvers) {
      const entry = await resolver.resolve(ref, context);
      if (entry) return entry;
    }
    return null;
  }
}
