import { GITHUB_TOKEN } from "astro:env/server";
import { ProxyParser } from "./application/ProxyParser";
import { CreateDocument } from "./application/CreateDocument";
import { UpdateDocument } from "./application/UpdateDocument";
import { DeleteDocument } from "./application/DeleteDocument";
import { GetAllDocuments } from "./application/GetAllDocuments";
import { GetDocument } from "./application/GetDocument";
import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import { DrizzleContentRepository } from "./infraestructure/repository/DrizzleContentRepository";
import { UnifiedDocumentParser } from "./infraestructure/parse/DocumentParser";
import { CreateDocumentController } from "./infraestructure/rest/CreateDocumentController";
import { UpdateDocumentController } from "./infraestructure/rest/UpdateDocumentController";
import { DeleteDocumentController } from "./infraestructure/rest/DeleteDocumentController";
import { CompositeReferenceResolver } from "./domain/reference/resolver";
import { InternalReferenceResolver } from "./infraestructure/reference/InternalReferenceResolver";
import { LocalFileReferenceResolver } from "./infraestructure/reference/LocalFileReferenceResolver";
import { GitHubReferenceResolver } from "./infraestructure/reference/GitHubReferenceResolver";
import {
  protectDocumentMutationRoutes,
  type DocumentMutationRoutes,
} from "./infraestructure/rest/protectDocumentMutationRoutes";
import type { RouteProtector } from "../../shared/server/capabilities/RouteProtector";
import type { EventBus } from "../../shared/domain/bus/EventBus";

export type { Document } from "./domain/Document";
export type { Heading } from "./domain/Heading";
export type { DocumentHash } from "./domain/DocumentHash";
export type { CreateDocumentRequest } from "./application/dto/CreateDocumentRequest";
export type { UpdateDocumentRequest } from "./application/dto/UpdateDocumentRequest";
export type { SerializedEntry } from "./application/dto/SerializedEntry";

export { DocumentCreated } from "./domain/events/DocumentCreated";
export { DocumentUpdated } from "./domain/events/DocumentUpdated";
export { DocumentDeleted } from "./domain/events/DocumentDeleted";
export { DocumentId } from "./domain/DocumentId";
export { DocumentPath } from "./domain/DocumentPath";
export { DrizzleContentOutboxDispatcher } from "./infraestructure/database/DrizzleContentOutboxDispatcher";

export class DocumentModule {
  constructor(
    public readonly createDocument: CreateDocument,
    public readonly createDocumentController: CreateDocumentController,
    public readonly updateDocumentController: UpdateDocumentController,
    public readonly deleteDocumentController: DeleteDocumentController,
    public readonly getAllDocuments: GetAllDocuments,
    public readonly getDocument: GetDocument,
    public readonly eventBus: EventBus,
    public readonly mutationRoutes: DocumentMutationRoutes,
  ) {}

  async refreshDocuments(nanobookId: string) {
    return this.getAllDocuments.refresh(nanobookId);
  }

  static async create(
    eventBus: EventBus,
    routeProtector: RouteProtector,
  ) {
    const contentRepository = new DrizzleContentRepository(
      db,
      new UnifiedDocumentParser(),
    );

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
    const deleteDocument = new DeleteDocument(contentRepository, eventBus);
    const getAllDocuments = new GetAllDocuments(contentRepository, proxyParser);
    const getDocument = new GetDocument(contentRepository, proxyParser);
    const updateDocumentController = new UpdateDocumentController(
      updateDocument
    );
    const deleteDocumentController = new DeleteDocumentController(
      deleteDocument
    );
    const createDocumentController = new CreateDocumentController(
      createDocument
    );
    const mutationRoutes = protectDocumentMutationRoutes(routeProtector, {
      POST: createDocumentController.handle,
      PATCH: updateDocumentController.handle,
      DELETE: deleteDocumentController.handle,
    });
    return new DocumentModule(
      createDocument,
      createDocumentController,
      updateDocumentController,
      deleteDocumentController,
      getAllDocuments,
      getDocument,
      eventBus,
      mutationRoutes,
    );
  }
}
