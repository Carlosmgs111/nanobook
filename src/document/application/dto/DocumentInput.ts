import type { Ref } from "../../domain/DocumentReference";

export interface DocumentInput {
  id?: string;
  path: string;
  title: string;
  description: string;
  content: string;
  date: Date;
  author?: string;
  cover?: string;
  tags?: string[];
  draft?: boolean;
  position?: number;
  ref?: Ref | string;
}
