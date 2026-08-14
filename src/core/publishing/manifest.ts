import type { Document } from "../content/types";
import type { ManifestEntry, SiteManifest } from "./types";

function toManifestEntry(document: Document): ManifestEntry {
  return {
    id: document.id,
    slug: document.slug,
    title: document.title,
    updatedAt: document.metadata.date.toISOString(),
    source: "filesystem", // Por defecto; se puede inferir del adapter en el futuro.
    dynamic: false,
  };
}

/**
 * Genera el manifiesto del sitio a partir de una lista de documentos.
 *
 * Este manifiesto se usará en el futuro para:
 * - Decidir en runtime si se sirve HTML estático o una versión dinámica.
 * - Trazar qué documentos han sido parcheados sin rebuild completo.
 * - Sincronizar el contenido entre builds.
 */
export function generateManifest(documents: Document[]): SiteManifest {
  return {
    generatedAt: new Date().toISOString(),
    documents: documents.map(toManifestEntry),
  };
}

/**
 * Serializa el manifiesto a JSON.
 */
export function serializeManifest(manifest: SiteManifest): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Parsea un manifiesto desde JSON.
 */
export function parseManifest(raw: string): SiteManifest {
  return JSON.parse(raw) as SiteManifest;
}
