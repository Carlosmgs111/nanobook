import type { Ref } from "../../domain/DocumentReference";

export interface DocumentInput {
  id: string;
  title: string;
  description: string;
  content: string;
  date: Date;
  index: boolean;
  author?: string;
  cover?: string;
  tags?: string[];
  draft?: boolean;
  position?: number;
  ref?: Ref | string;
}
