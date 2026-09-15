import type { DocumentId } from "./DocumentId";
import type { Ref } from "./DocumentReference";
import type { Heading } from "./Heading";

export interface DocumentMetadata {
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
  id: string;
  title: string;
  description: string;
  position: number;
  parentId?: string;
  rawFrontmatter: string;
  content: string;
  slug: string;
  proxyTargetId?: string;
  headings: Heading[];
  metadata: DocumentMetadata;
}
