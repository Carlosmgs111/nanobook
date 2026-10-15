import type { Document } from "../../../../documents/server";

export interface DocumentProvider {
  getAll(nanobookId: string): Promise<Document[]>;
  refresh(nanobookId: string): Promise<Document[]>;
}
