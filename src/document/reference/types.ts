import type { CollectionEntry } from "astro:content";
import type { ContentEntry, DocumentMetadata, RefValue } from "../model/types";

/**
 * Contexto que recibe cada resolutor de referencias.
 */
export interface ReferenceResolutionContext {
  /** ID del documento origen que contiene el `ref`. */
  sourceId: string;
  /** Metadatos del documento origen. */
  sourceData: DocumentMetadata;
  /** Raíz del proyecto, usada para resolver y validar rutas locales. */
  projectRoot: string;
  /** Lee un archivo relativo a la raíz del proyecto. */
  readFile(path: string): Promise<string>;
  /** Token opcional para peticiones a GitHub. */
  githubToken?: string;
}

/**
 * Plugin que sabe resolver un tipo concreto de referencia.
 */
export interface ReferenceResolverPlugin {
  /** Nombre identificativo del resolutor. */
  name: string;
  /** Indica si este resolutor puede manejar el valor de `ref`. */
  canResolve(ref: RefValue): boolean;
  /**
   * Resuelve la referencia y devuelve una entrada de contenido.
   * Devuelve `null` si la referencia es válida pero no se encuentra el destino.
   */
  resolve(
    ref: RefValue,
    context: ReferenceResolutionContext,
  ): Promise<ContentEntry | null>;
}

/**
 * Servicio que orquesta los resolutores de referencias.
 */
export interface ReferenceResolver {
  resolve(
    ref: RefValue,
    sourceEntry: CollectionEntry<"content">,
  ): Promise<ContentEntry | null>;
}
