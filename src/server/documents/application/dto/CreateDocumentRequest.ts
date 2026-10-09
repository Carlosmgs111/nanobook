import type { Ref } from "../../domain/DocumentReference";

export interface CreateDocumentRequest {
  id: string;
  path: string;
  title: string;
  description: string;
  content: string;
  author?: string;
  cover?: string;
  tags?: string[];
  draft?: boolean;
  nanobook?: boolean;
  position?: number;
  ref?: Ref | string;
}
