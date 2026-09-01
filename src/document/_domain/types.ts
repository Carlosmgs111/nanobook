/**
 * Contrato mínimo de un documento en Nanobook.
 *
 * Cualquier loader (filesystem, GitHub, base de datos, API) debe poder
 * producir esta estructura. El resto del dominio solo depende de estos
 * tipos, no de Astro ni de ninguna fuente concreta.
 */

import type { DocumentId } from "./DocumentId";

export interface LocalRef {
  source: "local";
  path: string;
}

export interface GitHubRef {
  source: "github";
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}

export interface UrlRef {
  source: "url";
  url: string;
}

export type RefValue = string | LocalRef | GitHubRef | UrlRef;

export interface DocumentMetadata {
  title: string;
  description: string;
  date: Date;
  author?: string;
  cover?: string;
  tags?: string[];
  draft?: boolean;
  index: boolean;
  position?: number;
  ref?: RefValue;
}

export interface Document {
  id: string;
  slug: string;
  parentId: string | null;
  position: number;
  title: string;
  description: string;
  content: string;
  metadata: DocumentMetadata;
  rawFrontmatter: string;
  proxyTargetId?: string;
}

/**
 * Entrada cruda tal como la producen los loaders actuales.
 * Es un paso intermedio hacia el tipo Document del dominio.
 */
export interface ContentEntry {
  id: string;
  data: DocumentMetadata;
  body?: string;
  rawFrontmatter?: string;
}

/**
 * Snapshot de hash de un documento para detectar cambios incrementales.
 */
export interface DocumentHash {
  id: string;
  contentHash: string;
  metadataHash: string;
}

/**
 * Contrato que debe implementar cualquier fuente de contenido.
 */
export interface ContentRepository {
  list(): Promise<import("./Document").Document[]>;
  get(id: DocumentId): Promise<import("./Document").Document | null>;
  getBySlug(slug: string): Promise<import("./Document").Document | null>;
  listChildren(parentId: string | null): Promise<import("./Document").Document[]>;
  create(document: import("./Document").Document): Promise<void>;
  update(document: import("./Document").Document): Promise<void>;
}
