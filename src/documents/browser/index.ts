import { RenderPreview } from "./application/RenderPreview";
import { InitializeEditor } from "./application/InitializeEditor";
import { SaveDocument } from "./application/SaveDocument";
import { DeleteDocument } from "./application/DeleteDocument";
import { RenameDocument } from "./application/RenameDocument";
import { HandleEditorChange } from "./application/HandleEditorChange";
import { GetRenderedDocument } from "./application/GetRenderedDocument";
import { CreateDocument } from "./application/CreateDocument";
import { SessionStorageDocumentStorage } from "./infraestructure/storage/SessionStorageDocumentStorage";
import { YamlDocumentContentParser } from "./infraestructure/parser/YamlDocumentContentParser";
import { HttpDocumentWriter } from "./infraestructure/documentWriter/HttpDocumentWriter";
import { WorkerMarkdownRenderer } from "./infraestructure/renderer/WorkerMarkdownRenderer";
import { EventTargetEventBus } from "../../shared/infrastructure/EventTargetEventBus";
import type { EventBus } from "../../shared/domain/bus/EventBus";

export { DocumentChanged } from "./domain/events/DocumentChanged";

export class EditionModule {
  private constructor(
    public readonly renderPreview: RenderPreview,
    public readonly initializeEditor: InitializeEditor,
    public readonly saveDocument: SaveDocument,
    public readonly deleteDocument: DeleteDocument,
    public readonly renameDocument: RenameDocument,
    public readonly createDocument: CreateDocument,
    public readonly getRenderedDocument: GetRenderedDocument,
    public readonly handleEditorChange: HandleEditorChange,
    public readonly eventBus: EventBus
  ) {}

  static create() {
    const storage = new SessionStorageDocumentStorage();
    const writer = new HttpDocumentWriter();
    const eventBus = new EventTargetEventBus();

    return new EditionModule(
      new RenderPreview(storage, new WorkerMarkdownRenderer(), eventBus),
      new InitializeEditor(storage),
      new SaveDocument(storage, writer),
      new DeleteDocument(storage, writer),
      new RenameDocument(storage, writer),
      new CreateDocument(writer),
      new GetRenderedDocument(storage),
      new HandleEditorChange(new YamlDocumentContentParser(), storage),
      eventBus
    );
  }
}
