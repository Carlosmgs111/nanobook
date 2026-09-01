import type { Document } from "../../document/_domain/types";

export interface ContentServices {
    listDocuments(): Promise<Document[]>;
}