import { RenderPreview } from "./application/RenderPreview";
import { InitializeEditor } from "./application/InitializeEditor";
import { SaveDocument } from "./application/SaveDocument";
import { HandleEditorChange } from "./application/HandleEditorChange";
import { PrepareEditorNavigation } from "./application/PrepareEditorNavigation";
import { SessionStorageDocumentStorage } from "./infraestructure/storage/SessionStorageDocumentStorage";
import { WorkerPreviewRenderer } from "./infraestructure/renderer/WorkerPreviewRenderer";
import { FetchPageWarmingService } from "./infraestructure/warming/FetchPageWarmingService";
import { YamlDocumentContentParser } from "./infraestructure/parser/YamlDocumentContentParser";
import { isInsideDocumentFlow as isInsideDocumentFlowService } from "./domain/services/DocumentFlow";

export { isInsideDocumentFlow } from "./domain/services/DocumentFlow";
export { confirmRenderedPreview } from "./domain/model/StagedDocument";
export { YamlDocumentContentParser } from "./infraestructure/parser/YamlDocumentContentParser";
export type { DocumentContentParser } from "./domain/ports/DocumentContentParser";
export type {
  SerializedEntry,
  RenderedPreview,
  EditionState,
} from "./domain/model/StagedDocument";
export type { DocumentStorage } from "./domain/ports/DocumentStorage";
export type { PreviewRenderer } from "./domain/ports/PreviewRenderer";
export type { PageWarmingService } from "./domain/ports/PageWarmingService";
export {
  EditionStorageError,
  EditionRenderError,
  InvalidDocumentContentError,
} from "./domain/errors";

export class EditionModule {
  private constructor(
    public readonly storage: SessionStorageDocumentStorage,
    public readonly renderer: WorkerPreviewRenderer,
    public readonly warmingService: FetchPageWarmingService,
    public readonly contentParser: YamlDocumentContentParser,
    public readonly renderPreview: RenderPreview,
    public readonly initializeEditor: InitializeEditor,
    public readonly saveDocument: SaveDocument,
    public readonly handleEditorChange: HandleEditorChange,
    public readonly prepareEditorNavigation: PrepareEditorNavigation,
    public readonly isInsideDocumentFlow: typeof isInsideDocumentFlowService
  ) {}

  static create() {
    const storage = new SessionStorageDocumentStorage();
    const renderer = new WorkerPreviewRenderer();
    const warmingService = new FetchPageWarmingService();
    const contentParser = new YamlDocumentContentParser();
    const renderPreview = new RenderPreview(storage, renderer);
    const initializeEditor = new InitializeEditor(
      storage
    );
    const saveDocument = new SaveDocument(
      contentParser,
      storage,
      warmingService,
      renderPreview
    );
    const handleEditorChange = new HandleEditorChange(
      contentParser,
      storage,
      renderPreview
    );
    const prepareEditorNavigation = new PrepareEditorNavigation(
      contentParser,
      renderPreview,
      storage
    );
    const isInsideDocumentFlow = isInsideDocumentFlowService;

    return new EditionModule(
      storage,
      renderer,
      warmingService,
      contentParser,
      renderPreview,
      initializeEditor,
      saveDocument,
      handleEditorChange,
      prepareEditorNavigation,
      isInsideDocumentFlow
    );
  }
}

export const edition = EditionModule.create();
