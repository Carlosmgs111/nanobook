import type { DocumentProvider } from "../../../../navigation/server/domain/ports/DocumentProvider";
import type { DocumentModule } from "../../index";

export class DocumentModuleDocumentProvider implements DocumentProvider {
  constructor(
    private readonly documentModule: DocumentModule,
  ) {}

  async getAll(nanobookId: string) {
    return this.documentModule.getAllDocuments.execute(nanobookId);
  }

  async refresh(nanobookId: string) {
    return this.documentModule.refreshDocuments(nanobookId);
  }
}
