import type {
  ContentEntry,
  DocumentMetadata,
} from "../types";

import type { DocumentId } from "../DocumentId";
import type { Document } from "../Document";
import type { DocumentReference } from "../DocumentReference";

/**
 * Contexto que recibe cada resolutor de referencias.
 */
export interface ReferenceResolutionContext {
  /** ID del documento origen que contiene el `ref`. */
  sourceId: DocumentId;
  /** Metadatos del documento origen. */
  sourceData: DocumentMetadata;
}

/**
 * Plugin que sabe resolver un tipo concreto de referencia.
 */
export interface ReferenceResolverPlugin {
  /** Nombre identificativo del resolutor. */
  name: string;
  resolve(
    ref: DocumentReference,
    context: ReferenceResolutionContext
  ): Promise<ContentEntry | null>;
}

/**
 * Servicio que orquesta los resolutores de referencias.
 */
export interface ReferenceResolver {
  resolve(
    ref: DocumentReference,
    sourceDocument: Document
  ): Promise<ContentEntry | null>;
}
