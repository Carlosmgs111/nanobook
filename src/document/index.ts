import { eventBus } from "../shared/bus";
import { createContentRepository } from "./infraestructure/repository";
import { ProxyParser } from "./application/ProxyParser";
import { CreateDocument } from "./application/CreateDocument";
import { UpdateDocument } from "./application/UpdateDocument";
import { GetAllDocuments } from "./application/GetAllDocuments";
import { GetDocument } from "./application/GetDocument";
export { GetDocument };
import { CreateDocumentController } from "./infraestructure/api/CreateDocumentController";
import { UpdateDocumentController } from "./infraestructure/api/UpdateDocumentController";
import { CompositeReferenceResolver } from "./domain/reference/resolver";
import { InternalReferenceResolver } from "./infraestructure/reference/InternalReferenceResolver";
import { LocalFileReferenceResolver } from "./infraestructure/reference/LocalFileReferenceResolver";
import { GitHubReferenceResolver } from "./infraestructure/reference/GitHubReferenceResolver";

export type { Document, Heading, DocumentHash } from "./domain/Document";
export { DocumentCreated } from "./domain/events/DocumentCreated";
export { DocumentUpdated } from "./domain/events/DocumentUpdated";
export { DocumentId } from "./domain/DocumentId";

export class DocumentModule {
  constructor(
    public createDocumentController: CreateDocumentController,
    public updateDocumentController: UpdateDocumentController,
    public getAllDocuments: GetAllDocuments,
    public getDocument: GetDocument
  ) {}
  static async create() {
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
    const createDocument = new CreateDocument(contentRepository, eventBus);
    const updateDocument = new UpdateDocument(contentRepository, eventBus);
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
      getDocument
    );
  }
}
