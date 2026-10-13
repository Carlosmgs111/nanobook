import type { Ref } from "../../domain/DocumentReference";

export interface DocumentInput {
  id?: string;
  expectedRevision?: number;
  path: string;
  title: string;
  description: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
  ownerId?: string;
  author?: string;
  cover?: string;
  tags?: string[];
  draft?: boolean;
  nanobook?: boolean;
  position?: number;
  ref?: Ref | string;
}
