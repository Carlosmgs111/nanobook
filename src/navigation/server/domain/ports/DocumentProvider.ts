import type { Document } from "../../../../documents/server";

export interface DocumentProvider {
  getAll(): Promise<Document[]>;
  refresh?(): Promise<Document[]>;
}
