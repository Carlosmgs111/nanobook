import type { Ref } from "../../domain/DocumentReference";

export interface UpdateDocumentRequest {
  path: string;
  title: string;
  description: string;
  content: string;
  /** Identity and audit fields are server-controlled on update. */
  cover?: string;
  tags?: string[];
  draft?: boolean;
  nanobook?: boolean;
  position?: number;
  ref?: Ref | string;
}
