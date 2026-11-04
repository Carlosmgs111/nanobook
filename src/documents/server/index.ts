import { BETTER_AUTH_SECRET, GITHUB_TOKEN } from "astro:env/server";
import { AuthorizeDocumentAccess } from "./application/access/AuthorizeDocumentAccess";
import { ClearDocumentPassword } from "./application/access/ClearDocumentPassword";
import { SetDocumentPassword } from "./application/access/SetDocumentPassword";
import { UnlockDocument } from "./application/access/UnlockDocument";
import { DEFAULT_ACCESS_GRANT_POLICY } from "./domain/access/AccessGrantPolicy";
import { PasswordAccessPolicy } from "./domain/access/DocumentAccessPolicy";
import { DrizzleDocumentAccessRepository } from "./infraestructure/access/DrizzleDocumentAccessRepository";
import { DrizzleUnlockAttemptLimiter } from "./infraestructure/access/DrizzleUnlockAttemptLimiter";
import { HmacAccessGrantCodec } from "./infraestructure/access/HmacAccessGrantCodec";
import { ScryptPasswordHasher } from "./infraestructure/access/ScryptPasswordHasher";
import { DocumentAccessAdminController } from "./infraestructure/rest/DocumentAccessAdminController";
import { UnlockDocumentController } from "./infraestructure/rest/UnlockDocumentController";
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
import type { EventBus } from "../../shared/domain/bus/EventBus";
import { DocumentCreated } from "./domain/events/DocumentCreated";
import { DocumentUpdated } from "./domain/events/DocumentUpdated";
import { DocumentDeleted } from "./domain/events/DocumentDeleted";
import { createDocumentSourceCache } from "./infraestructure/cache/createDocumentSourceCache";
import { InvalidateDocumentSourceCache } from "./application/event-handlers/InvalidateDocumentSourceCache";

export type { Document } from "./domain/Document";
export type { Heading } from "./domain/Heading";
export type { CreateDocumentRequest } from "./application/dto/CreateDocumentRequest";
export type { UpdateDocumentRequest } from "./application/dto/UpdateDocumentRequest";
export type { SerializedEntry } from "./application/dto/SerializedEntry";

export { DocumentCreated } from "./domain/events/DocumentCreated";
export { DocumentUpdated } from "./domain/events/DocumentUpdated";
export { DocumentDeleted } from "./domain/events/DocumentDeleted";
export { DocumentId } from "./domain/DocumentId";
export { DocumentPath } from "./domain/DocumentPath";
export class DocumentModule {
  constructor(
    public readonly createDocument: CreateDocument,
    public readonly updateDocument: UpdateDocument,
    public readonly createDocumentController: CreateDocumentController,
    public readonly updateDocumentController: UpdateDocumentController,
    public readonly deleteDocumentController: DeleteDocumentController,
    public readonly getAllDocuments: GetAllDocuments,
    public readonly getDocument: GetDocument,
    public readonly authorizeDocumentAccess: AuthorizeDocumentAccess,
    public readonly documentAccessAdminController: DocumentAccessAdminController,
    public readonly unlockDocumentController: UnlockDocumentController,
  ) {}

  static async create(eventBus: EventBus) {
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
    const sourceCache = createDocumentSourceCache();
    const createDocument = new CreateDocument(contentRepository, eventBus);
    const updateDocument = new UpdateDocument(contentRepository, eventBus);
    const deleteDocument = new DeleteDocument(contentRepository, eventBus);
    const getAllDocuments = new GetAllDocuments(contentRepository, proxyParser);
    const getDocument = new GetDocument(contentRepository, proxyParser, sourceCache);
    const invalidateDocumentSourceCache = new InvalidateDocumentSourceCache(sourceCache);
    eventBus.subscribe(DocumentCreated, invalidateDocumentSourceCache);
    eventBus.subscribe(DocumentUpdated, invalidateDocumentSourceCache);
    eventBus.subscribe(DocumentDeleted, invalidateDocumentSourceCache);
    const updateDocumentController = new UpdateDocumentController(
      updateDocument
    );
    const deleteDocumentController = new DeleteDocumentController(
      deleteDocument
    );
    const createDocumentController = new CreateDocumentController(
      createDocument
    );
    const accessRepository = new DrizzleDocumentAccessRepository(db);
    const grantCodec = new HmacAccessGrantCodec(
      BETTER_AUTH_SECRET ?? "nanobook-development-secret",
    );
    const hasher = new ScryptPasswordHasher();
    const unlockLimiter = new DrizzleUnlockAttemptLimiter(db, DEFAULT_ACCESS_GRANT_POLICY);
    const authorizeDocumentAccess = new AuthorizeDocumentAccess(
      accessRepository,
      grantCodec,
      new PasswordAccessPolicy(),
    );
    const unlockDocument = new UnlockDocument(
      getDocument,
      accessRepository,
      hasher,
      unlockLimiter,
      grantCodec,
      DEFAULT_ACCESS_GRANT_POLICY,
    );
    const documentAccessAdminController = new DocumentAccessAdminController(
      new SetDocumentPassword(contentRepository, accessRepository, hasher, eventBus),
      new ClearDocumentPassword(contentRepository, accessRepository, eventBus),
    );
    const unlockDocumentController = new UnlockDocumentController(unlockDocument);
    return new DocumentModule(
      createDocument,
      updateDocument,
      createDocumentController,
      updateDocumentController,
      deleteDocumentController,
      getAllDocuments,
      getDocument,
      authorizeDocumentAccess,
      documentAccessAdminController,
      unlockDocumentController,
    );
  }
}
