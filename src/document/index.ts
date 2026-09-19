
import { GITHUB_TOKEN } from "astro:env/server";
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
import type { Document } from "./domain/Document";
import type { EventBus } from "../shared/domain/bus/EventBus";

export type { Document } from "./domain/Document";
export type { Heading } from "./domain/Heading";
export type { DocumentHash } from "./domain/DocumentHash";
export type { CreateDocumentRequest } from "./application/dto/CreateDocumentRequest";
export type { UpdateDocumentRequest } from "./application/dto/UpdateDocumentRequest";
export type { SerializedEntry } from "./application/dto/SerializedEntry";

export { DocumentCreated } from "./domain/events/DocumentCreated";
export { DocumentUpdated } from "./domain/events/DocumentUpdated";
export { DocumentId } from "./domain/DocumentId";

export class DocumentModule {
  constructor(
    public readonly createDocumentController: CreateDocumentController,
    public readonly updateDocumentController: UpdateDocumentController,
    public readonly getAllDocuments: GetAllDocuments,
    public readonly getDocument: GetDocument,
    public readonly eventBus: EventBus
  ) {}
  static async create(eventBus: EventBus) {
    const contentRepository = await createContentRepository();

    const internalReferenceResolver = new InternalReferenceResolver(
      contentRepository
    );
    const localFileReferenceResolver = new LocalFileReferenceResolver();

    const plugins = [internalReferenceResolver, localFileReferenceResolver];

    if (GITHUB_TOKEN) {
      plugins.push(new GitHubReferenceResolver());
    }

    const referenceResolver = new CompositeReferenceResolver(plugins);
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
      getDocument,
      eventBus
    );
  }
}
