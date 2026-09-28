import type { Document } from "../../../document";

export interface DocumentProvider {
  getAll(): Promise<Document[]>;
  refresh?(): Promise<Document[]>;
}
