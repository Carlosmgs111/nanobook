import type { DocumentId } from "./DocumentId";
import type { Ref } from "./DocumentReference";
import type { Heading } from "./Heading";

export interface DocumentMetadata {
  /** Stable identity persisted with the document when available. */
  id?: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  /** Stable Better Auth account identity that owns this document. */
  ownerId?: string;
  author?: string;
  cover?: string;
  tags?: string[];
  draft?: boolean | undefined;
  /** Declares an index document as the root of an independently navigable Nanobook. */
  nanobook?: boolean;
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
  /** Monotonic SQL revision used for optimistic concurrency when available. */
  revision?: number;
  /** Mutable public/content path. */
  path: string;
  /** Whether the internal path represents a directory index. */
  isIndex: boolean;
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
