import type { DocumentId } from "./DocumentId";
import type { Ref } from "./DocumentReference";
import type { Heading } from "./Heading";

export interface DocumentMetadata {
  /** Stable identity persisted with the document when available. */
  id?: string;
  title: string;
  description: string;
  date: Date;
  author?: string;
  cover?: string;
  tags?: string[];
  draft?: boolean | undefined;
  index: boolean;
  position?: number;
  ref?: Ref | string;
}

export interface ContentEntry {
  id: DocumentId;
  data: DocumentMetadata;
  body?: string;
  rawFrontmatter?: string;
}

export interface Entry {
  /** Stable entity identity. */
  documentId: string;
  /** Mutable public/content path. */
  path: string;
  /** Hash of the current document state. */
  version: string;
  id: string;
  title: string;
  description: string;
  position: number;
  /** Public path of the parent, not a document identity. */
  parentPath?: string;
  rawFrontmatter: string;
  content: string;
  slug: string;
  ref?: string;
  headings: Heading[];
  metadata: DocumentMetadata;
}
