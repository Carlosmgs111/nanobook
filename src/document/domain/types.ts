import type { DocumentId } from "./DocumentId";
import type { Document, Heading } from "./Document";
import type { Ref } from "./DocumentReference";

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

export interface ContentRepository {
  list(): Promise<Document[]>;
  get(id: DocumentId): Promise<Document | null>;
  getBySlug(slug: string): Promise<Document | null>;
  listChildren(parentId: string | null): Promise<Document[]>;
  create(document: Document): Promise<void>;
  update(document: Document): Promise<void>;
}

export interface DocumentInput {
  id: string;
  title: string;
  description: string;
  author?: string;
  date: Date;
  index: boolean;
  position?: number;
  draft?: boolean;
  tags?: string[];
  content: string;

}


export interface Entry {
  id: string;
  title: string;
  description: string;
  position?: number;
  parentId?: string;  
  rawFrontmatter?: string;
  content?: string;
  slug?: string;
  headings: Heading[];
  metadata: {
    title: string;
    description: string;
    draft?: boolean;
    index: boolean;
    position?: number;
    art?: string;
    date: Date;
    author?: string;
  };
}