import type { DocumentProvider } from "../../../navigation/domain/ports/DocumentProvider";
import type { DocumentModule } from "../../index";

export class DocumentModuleDocumentProvider implements DocumentProvider {
  constructor(private documentModule: DocumentModule) {}

  async getAll() {
    return this.documentModule.getAllDocuments.execute();
  }
}
