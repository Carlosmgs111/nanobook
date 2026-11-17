import type { ContentEntry } from "../types";
import type { DocumentPath } from "../DocumentPath";
import type { DocumentReference } from "../DocumentReference";

/** Contexto que recibe cada resolutor: dónde vive el documento que declara el `ref`. */
export interface ReferenceResolutionContext {
  nanobookId: string;
  sourcePath: DocumentPath;
}

/** Sabe resolver un tipo de referencia; devuelve `null` si el `ref` no es suyo o no existe. */
export interface ReferenceResolver {
  resolve(ref: DocumentReference, context: ReferenceResolutionContext): Promise<ContentEntry | null>;
}
