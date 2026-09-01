import { DocumentId } from "./DocumentId";

export interface DocumentPathMapper {
  idToFilePath(id: DocumentId, isIndex: boolean): string;
  filePathToId(filePath: string): string;
}
