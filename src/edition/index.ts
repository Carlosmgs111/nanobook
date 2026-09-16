import { BuildStagedDocument } from "./application/BuildStagedDocument";
import { StageDocument } from "./application/StageDocument";
import { LoadStagedDocument } from "./application/LoadStagedDocument";
import { ClearEditionStorage } from "./application/ClearEditionStorage";
import { RenderPreview } from "./application/RenderPreview";
import { ConfirmRenderedPreview } from "./application/ConfirmRenderedPreview";
import { WarmDocumentPage } from "./application/WarmDocumentPage";
import { MarkDocumentSaved } from "./application/MarkDocumentSaved";
import { SessionStorageDocumentStorage } from "./infraestructure/storage/SessionStorageDocumentStorage";
import { WorkerPreviewRenderer } from "./infraestructure/renderer/WorkerPreviewRenderer";
import { FetchPageWarmingService } from "./infraestructure/warming/FetchPageWarmingService";
import { isInsideDocumentFlow as isInsideDocumentFlowService } from "./domain/services/DocumentFlow";

export { isInsideDocumentFlow } from "./domain/services/DocumentFlow";
export { confirmRenderedPreview } from "./domain/services/RenderConfirmation";
export { buildDocumentFromContent } from "./domain/services/DocumentContentParser";
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
  public readonly storage: SessionStorageDocumentStorage;
  public readonly renderer: WorkerPreviewRenderer;
  public readonly warmingService: FetchPageWarmingService;

  public readonly buildStagedDocument: BuildStagedDocument;
  public readonly stageDocument: StageDocument;
  public readonly loadStagedDocument: LoadStagedDocument;
  public readonly clearEditionStorage: ClearEditionStorage;
  public readonly renderPreview: RenderPreview;
  public readonly confirmRenderedPreview: ConfirmRenderedPreview;
  public readonly warmDocumentPage: WarmDocumentPage;
  public readonly markDocumentSaved: MarkDocumentSaved;
  public readonly isInsideDocumentFlow: typeof isInsideDocumentFlowService;

  constructor() {
    this.storage = new SessionStorageDocumentStorage();
    this.renderer = new WorkerPreviewRenderer();
    this.warmingService = new FetchPageWarmingService();

    this.buildStagedDocument = new BuildStagedDocument();
    this.stageDocument = new StageDocument(this.storage);
    this.loadStagedDocument = new LoadStagedDocument(this.storage);
    this.clearEditionStorage = new ClearEditionStorage(this.storage);
    this.renderPreview = new RenderPreview(this.storage, this.renderer);
    this.confirmRenderedPreview = new ConfirmRenderedPreview();
    this.warmDocumentPage = new WarmDocumentPage(this.warmingService);
    this.markDocumentSaved = new MarkDocumentSaved(this.storage);
    this.isInsideDocumentFlow = isInsideDocumentFlowService;
  }
}

export const edition = new EditionModule();
