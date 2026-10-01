import type { Document } from "../../../documents";

export interface DocumentProvider {
  getAll(): Promise<Document[]>;
  refresh?(): Promise<Document[]>;
}
