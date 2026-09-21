import { RenderPreview } from "./application/RenderPreview";
import { InitializeEditor } from "./application/InitializeEditor";
import { SaveDocument } from "./application/SaveDocument";
import { HandleEditorChange } from "./application/HandleEditorChange";
import { SessionStorageDocumentStorage } from "./infraestructure/storage/SessionStorageDocumentStorage";
import { YamlDocumentContentParser } from "./infraestructure/parser/YamlDocumentContentParser";
import { HttpDocumentWriter } from "./infraestructure/documentWriter/HttpDocumentWriter";
import { CreateDocument } from "./application/CreateDocument";
import { MarkdownItRenderer } from "./infraestructure/renderer/MarkdownItRenderer";
import { DelegatedMarkdownItRenderer } from "./infraestructure/renderer/DelegatedMarkdownItRenderer";

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

export class EditionModule {
  private constructor(
    public readonly renderPreview: RenderPreview,
    public readonly initializeEditor: InitializeEditor,
    public readonly saveDocument: SaveDocument,
    public readonly createDocument: CreateDocument,
    public readonly handleEditorChange: HandleEditorChange
  ) {}

  static create() {
    const storage = new SessionStorageDocumentStorage();
    const contentParser = new YamlDocumentContentParser();
    const documentWriter = new HttpDocumentWriter();
    // const renderer = new MarkdownItRenderer();
    const delegatedRenderer = new DelegatedMarkdownItRenderer();

    const renderPreview = new RenderPreview(storage, delegatedRenderer);
    const saveDocument = new SaveDocument(storage, documentWriter);
    const createDocument = new CreateDocument(documentWriter);
    const handleEditorChange = new HandleEditorChange(contentParser, storage);
    const initializeEditor = new InitializeEditor(storage);

    return new EditionModule(
      renderPreview,
      initializeEditor,
      saveDocument,
      createDocument,
      handleEditorChange
    );
  }
}

export const edition = EditionModule.create();
