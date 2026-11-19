import type { Authorizer } from "../../authorization/server";
import type { DocumentModule } from "../../documents/server";
import { SaveSpreadsheet } from "./application/SaveSpreadsheet";
import { DocumentModuleSpreadsheetDocuments } from "./infraestructure/documents/DocumentModuleSpreadsheetDocuments";
import { SaveSpreadsheetController } from "./infraestructure/rest/SaveSpreadsheetController";

/** Compositor del lado servidor de `spreadsheets`: guarda en el documento los cambios de una hoja. */
export class SpreadsheetsServerModule {
  private constructor(
    public readonly saveSpreadsheet: SaveSpreadsheet,
    public readonly saveSpreadsheetController: SaveSpreadsheetController
  ) {}

  static create(
    documents: Pick<DocumentModule, "getDocument" | "updateDocument">,
    authorizer: Authorizer
  ): SpreadsheetsServerModule {
    const saveSpreadsheet = new SaveSpreadsheet(
      authorizer,
      new DocumentModuleSpreadsheetDocuments(documents)
    );
    return new SpreadsheetsServerModule(
      saveSpreadsheet,
      new SaveSpreadsheetController(saveSpreadsheet)
    );
  }
}
