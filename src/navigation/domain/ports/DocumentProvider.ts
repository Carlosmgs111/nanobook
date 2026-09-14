import type { Document } from "../../../document";

export interface DocumentProvider {
  getAll(): Promise<Document[]>;
}
