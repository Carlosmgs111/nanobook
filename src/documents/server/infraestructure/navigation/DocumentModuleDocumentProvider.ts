import type { DocumentProvider } from "../../../../navigation/server/domain/ports/DocumentProvider";
import type { DocumentModule } from "../../index";

export class DocumentModuleDocumentProvider implements DocumentProvider {
  constructor(
    private readonly documentModule: DocumentModule,
    private readonly nanobookId: string,
  ) {}

  async getAll() {
    return this.documentModule.getAllDocuments.execute(this.nanobookId);
  }

  async refresh() {
    return this.documentModule.refreshDocuments(this.nanobookId);
  }
}
