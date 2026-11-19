import { BETTER_AUTH_SECRET, GITHUB_TOKEN } from "astro:env/server";
import type { EventBus } from "../../shared/domain/bus/EventBus";
import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import type { Authorization } from "../../authorization/server";
import { DocumentPasswordPolicy } from "./infraestructure/access/DocumentPasswordPolicy";
import { ClearDocumentPassword } from "./application/access/ClearDocumentPassword";
import { SetDocumentPassword } from "./application/access/SetDocumentPassword";
import { UnlockDocument } from "./application/access/UnlockDocument";
import { InvalidateDocumentSourceCache } from "./application/event-handlers/InvalidateDocumentSourceCache";
import { CreateDocument } from "./application/CreateDocument";
import { DeleteDocument } from "./application/DeleteDocument";
import { GetAllDocuments } from "./application/GetAllDocuments";
import { GetDocument } from "./application/GetDocument";
import { ListReadableDocuments } from "./application/ListReadableDocuments";
import { ProxyParser } from "./application/ProxyParser";
import { ReadDocument } from "./application/ReadDocument";
import { UpdateDocument } from "./application/UpdateDocument";
import { DEFAULT_ACCESS_GRANT_POLICY } from "./domain/access/AccessGrantPolicy";
import { DocumentCreated } from "./domain/events/DocumentCreated";
import { DocumentDeleted } from "./domain/events/DocumentDeleted";
import { DocumentUpdated } from "./domain/events/DocumentUpdated";
import type { ReferenceResolver } from "./domain/reference/types";
import { DrizzleDocumentAccessRepository } from "./infraestructure/access/DrizzleDocumentAccessRepository";
import { DrizzleUnlockAttemptLimiter } from "./infraestructure/access/DrizzleUnlockAttemptLimiter";
import { HmacAccessGrantCodec } from "./infraestructure/access/HmacAccessGrantCodec";
import { ScryptPasswordHasher } from "./infraestructure/access/ScryptPasswordHasher";
import { createDocumentSourceCache } from "./infraestructure/cache/createDocumentSourceCache";
import { UnifiedDocumentParser } from "./infraestructure/parse/DocumentParser";
import { GitHubReferenceResolver } from "./infraestructure/reference/GitHubReferenceResolver";
import { InternalReferenceResolver } from "./infraestructure/reference/InternalReferenceResolver";
import { LocalFileReferenceResolver } from "./infraestructure/reference/LocalFileReferenceResolver";
import { DrizzleContentRepository } from "./infraestructure/repository/DrizzleContentRepository";
import { CreateDocumentController } from "./infraestructure/rest/CreateDocumentController";
import { DeleteDocumentController } from "./infraestructure/rest/DeleteDocumentController";
import { DocumentAccessAdminController } from "./infraestructure/rest/DocumentAccessAdminController";
import { UnlockDocumentController } from "./infraestructure/rest/UnlockDocumentController";
import { UpdateDocumentController } from "./infraestructure/rest/UpdateDocumentController";

export type { Document } from "./domain/Document";
export type { Heading } from "./domain/Heading";
export type { CreateDocumentRequest } from "./application/dto/CreateDocumentRequest";
export type { UpdateDocumentRequest } from "./application/dto/UpdateDocumentRequest";
export type { SerializedEntry } from "./application/dto/SerializedEntry";
export type { DocumentViewer, ReadDocumentResult } from "./application/ReadDocument";

export { DocumentCreated } from "./domain/events/DocumentCreated";
export { DocumentUpdated } from "./domain/events/DocumentUpdated";
export { DocumentDeleted } from "./domain/events/DocumentDeleted";
export { grantsFromCookieHeader } from "./infraestructure/rest/GrantCookie";
export { DocumentRepositoryError, DocumentRevisionConflictError } from "./domain/errors";
export { DocumentId } from "./domain/DocumentId";
export { DocumentPath } from "./domain/DocumentPath";

/** Compositor de documentos: lo que expone al resto de módulos y las rutas HTTP. */
export class DocumentModule {
  private constructor(
    public readonly createDocument: CreateDocument,
    public readonly updateDocument: UpdateDocument,
    public readonly getAllDocuments: GetAllDocuments,
    public readonly getDocument: GetDocument,
    public readonly readDocument: ReadDocument,
    public readonly listReadableDocuments: ListReadableDocuments,
    public readonly createDocumentController: CreateDocumentController,
    public readonly updateDocumentController: UpdateDocumentController,
    public readonly deleteDocumentController: DeleteDocumentController,
    public readonly documentAccessAdminController: DocumentAccessAdminController,
    public readonly unlockDocumentController: UnlockDocumentController,
  ) {}

  /**
   * Compone el módulo y registra en `authorization` la política de contraseña. Esa política es una
   * restricción (nunca concede): sin registrarla, la protección de lectura no se aplica y un documento
   * protegido de un nanobook público se serviría sin desafío; por eso `create` la registra siempre.
   */
  static async create(eventBus: EventBus, authorization: Authorization) {
    // Persistencia y resolución de referencias entre documentos.
    const contentRepository = new DrizzleContentRepository(db, new UnifiedDocumentParser());
    const referenceResolvers: ReferenceResolver[] = [new InternalReferenceResolver(contentRepository), new LocalFileReferenceResolver()];
    if (GITHUB_TOKEN) referenceResolvers.push(new GitHubReferenceResolver());
    const proxyParser = new ProxyParser(referenceResolvers);

    // Escritura: cada caso de uso exige permiso de escritura sobre el nanobook.
    const createDocument = new CreateDocument(contentRepository, eventBus, authorization);
    const updateDocument = new UpdateDocument(contentRepository, eventBus, authorization);
    const deleteDocument = new DeleteDocument(contentRepository, eventBus, authorization);

    // Lectura sin protección, con la caché de fuentes invalidada por los eventos de documento.
    const sourceCache = createDocumentSourceCache();
    const getAllDocuments = new GetAllDocuments(contentRepository, proxyParser);
    const getDocument = new GetDocument(contentRepository, proxyParser, sourceCache);
    const invalidateSourceCache = new InvalidateDocumentSourceCache(sourceCache);
    for (const event of [DocumentCreated, DocumentUpdated, DocumentDeleted]) {
      eventBus.subscribe(event, invalidateSourceCache);
    }

    // Protección por contraseña: desbloqueo, grants firmados y lecturas que los aplican.
    const accessRepository = new DrizzleDocumentAccessRepository(db);
    const grantCodec = new HmacAccessGrantCodec(BETTER_AUTH_SECRET ?? "nanobook-development-secret");
    const hasher = new ScryptPasswordHasher();
    const unlockLimiter = new DrizzleUnlockAttemptLimiter(db, DEFAULT_ACCESS_GRANT_POLICY);
    authorization.register(new DocumentPasswordPolicy(accessRepository, grantCodec));
    const unlockDocument = new UnlockDocument(
      getDocument,
      accessRepository,
      hasher,
      unlockLimiter,
      grantCodec,
      DEFAULT_ACCESS_GRANT_POLICY,
    );
    const readDocument = new ReadDocument(getDocument, authorization);
    const listReadableDocuments = new ListReadableDocuments(contentRepository, proxyParser, authorization);

    return new DocumentModule(
      createDocument,
      updateDocument,
      getAllDocuments,
      getDocument,
      readDocument,
      listReadableDocuments,
      new CreateDocumentController(createDocument),
      new UpdateDocumentController(updateDocument),
      new DeleteDocumentController(deleteDocument),
      new DocumentAccessAdminController(
        new SetDocumentPassword(contentRepository, accessRepository, hasher, eventBus, authorization),
        new ClearDocumentPassword(contentRepository, accessRepository, eventBus, authorization),
      ),
      new UnlockDocumentController(unlockDocument),
    );
  }
}
