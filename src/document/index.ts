import type { EventBus } from "../shared/bus/EventBus";
import { Result } from "../shared/utils/result";
export type { Document, Heading, DocumentHash } from "./domain/Document";
export { DocumentCreated } from "./domain/events/DocumentCreated";
export { DocumentUpdated } from "./domain/events/DocumentUpdated";
export { DocumentId } from "./domain/DocumentId";
export type { DocumentChangeNotifier } from "./domain/types";
import { ProxyParser } from "./application/ProxyParser";
import { CreateDocument } from "./application/CreateDocument";
import { UpdateDocument } from "./application/UpdateDocument";
import { GetAllDocuments } from "./application/GetAllDocuments";
import { GetDocument } from "./application/GetDocument";
import { createContentRepository } from "./infraestructure/repository";
import { CreateDocumentController } from "./infraestructure/api/CreateDocumentController";
import { UpdateDocumentController } from "./infraestructure/api/UpdateDocumentController";
import { CompositeReferenceResolver } from "./domain/reference/resolver";
import { InternalReferenceResolver } from "./infraestructure/reference/InternalReferenceResolver";
import { LocalFileReferenceResolver } from "./infraestructure/reference/LocalFileReferenceResolver";
import { GitHubReferenceResolver } from "./infraestructure/reference/GitHubReferenceResolver";
import type { DocumentChangeNotifier } from "./domain/types";

const noOpNotifier: DocumentChangeNotifier = {
  onDocumentCreated: async () => Result.ok(),
  onDocumentUpdated: async () => Result.ok(),
};

export class DocumentModule {
  constructor(
    public readonly createDocumentController: CreateDocumentController,
    public readonly updateDocumentController: UpdateDocumentController,
    public readonly getAllDocuments: GetAllDocuments,
    public readonly getDocument: GetDocument,
    public readonly eventBus: EventBus
  ) {}
  static async create(
    eventBus: EventBus,
    notifier: DocumentChangeNotifier = noOpNotifier
  ) {
    const contentRepository = await createContentRepository();

    const internalReferenceResolver = new InternalReferenceResolver(
      contentRepository
    );
    const localFileReferenceResolver = new LocalFileReferenceResolver();
    const githubReferenceResolver = new GitHubReferenceResolver();

    const referenceResolver = new CompositeReferenceResolver([
      internalReferenceResolver,
      localFileReferenceResolver,
      githubReferenceResolver,
    ]);
    const proxyParser = new ProxyParser(referenceResolver);
    const createDocument = new CreateDocument(
      contentRepository,
      eventBus,
      notifier
    );
    const updateDocument = new UpdateDocument(
      contentRepository,
      eventBus,
      notifier
    );
    const getAllDocuments = new GetAllDocuments(contentRepository, proxyParser);
    const getDocument = new GetDocument(contentRepository, proxyParser);
    const updateDocumentController = new UpdateDocumentController(
      updateDocument
    );
    const createDocumentController = new CreateDocumentController(
      createDocument
    );
    return new DocumentModule(
      createDocumentController,
      updateDocumentController,
      getAllDocuments,
      getDocument,
      eventBus
    );
  }
}
