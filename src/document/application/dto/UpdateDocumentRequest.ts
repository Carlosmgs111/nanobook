import type { Ref } from "../../domain/DocumentReference";

export interface UpdateDocumentRequest {
  id: string;
  title: string;
  description: string;
  content: string;
  date: string;
  index: boolean;
  author?: string;
  cover?: string;
  tags?: string[];
  draft?: boolean;
  position?: number;
  ref?: Ref | string;
}
