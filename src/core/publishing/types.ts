import type { Document } from "../content/types";

/**
 * Entrada del manifiesto del sitio.
 *
 * El manifiesto rastrea metadatos de cada documento publicado y permite
 * decidir en runtime si se sirve la versión estática o una versión
 * dinámica (parche).
 */
export interface ManifestEntry {
  id: string;
  slug: string;
  title: string;
  updatedAt: string;
  source: "filesystem" | "github" | "database";
  dynamic: boolean;
}

/**
 * Manifiesto completo del sitio.
 */
export interface SiteManifest {
  generatedAt: string;
  documents: ManifestEntry[];
}

/**
 * Contrato para un publisher.
 *
 * Un publisher se encarga de materializar el sitio público a partir del
 * modelo de contenido. Puede ser:
 *
 * - Static: genera HTML estático en build time (Astro SSG).
 * - SSR: renderiza bajo demanda en runtime.
 * - Hybrid: mezcla estático con parches dinámicos.
 */
export interface Publisher {
  publish(document: Document, rendered: { html: string }): Promise<void>;
  generateManifest(documents: Document[]): Promise<SiteManifest>;
}
