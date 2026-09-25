import { RenderPreview } from "./application/RenderPreview";
import { InitializeEditor } from "./application/InitializeEditor";
import { SaveDocument } from "./application/SaveDocument";
import { HandleEditorChange } from "./application/HandleEditorChange";
import { GetRenderedDocument } from "./application/GetRenderedDocument";
import { SessionStorageDocumentStorage } from "./infraestructure/storage/SessionStorageDocumentStorage";
import { YamlDocumentContentParser } from "./infraestructure/parser/YamlDocumentContentParser";
import { HttpDocumentWriter } from "./infraestructure/documentWriter/HttpDocumentWriter";
import { CreateDocument } from "./application/CreateDocument";
import { DelegatedMarkdownItRenderer } from "./infraestructure/renderer/DelegatedMarkdownItRenderer";
import { EventTargetEventBus } from "../shared/infraestructure/EventTargetEventBus";
import type { EventBus } from "../shared/domain/bus/EventBus";

export { YamlDocumentContentParser } from "./infraestructure/parser/YamlDocumentContentParser";
export type { DocumentContentParser } from "./domain/ports/DocumentContentParser";
export type {
  SerializedEntry,
  RenderedPreview,
  CachedPreview,
} from "./domain/model/StagedDocument";
export type { DocumentStorage } from "./domain/ports/DocumentStorage";
export type { PreviewRenderer } from "./domain/ports/PreviewRenderer";
export {
  EditionStorageError,
  EditionRenderError,
  InvalidDocumentContentError,
} from "./domain/errors";
export { DocumentChanged } from "./domain/events/DocumentChanged";

export class EditionModule {
  private constructor(
    public readonly renderPreview: RenderPreview,
    public readonly initializeEditor: InitializeEditor,
    public readonly saveDocument: SaveDocument,
    public readonly createDocument: CreateDocument,
    public readonly getRenderedDocument: GetRenderedDocument,
    public readonly handleEditorChange: HandleEditorChange,
    public readonly eventBus: EventBus
  ) {}

  static create() {
    const storage = new SessionStorageDocumentStorage();
    const contentParser = new YamlDocumentContentParser();
    const documentWriter = new HttpDocumentWriter();
    const delegatedRenderer = new DelegatedMarkdownItRenderer();
    const eventBus = new EventTargetEventBus();

    const renderPreview = new RenderPreview(
      storage,
      delegatedRenderer,
      eventBus
    );
    const saveDocument = new SaveDocument(storage, documentWriter, renderPreview);
    const createDocument = new CreateDocument(documentWriter);
    const handleEditorChange = new HandleEditorChange(contentParser, storage);
    const initializeEditor = new InitializeEditor(storage);
    const getRenderedDocument = new GetRenderedDocument(storage);

    return new EditionModule(
      renderPreview,
      initializeEditor,
      saveDocument,
      createDocument,
      getRenderedDocument,
      handleEditorChange,
      eventBus
    );
  }
}

export const edition = EditionModule.create();
