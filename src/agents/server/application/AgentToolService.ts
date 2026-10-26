import { Result } from "../../../shared/domain/Result";
import type { DocumentModule } from "../../../documents/server";
import { serializeEntry } from "../../../documents/server/application/dto/SerializedEntry";
import { DocumentNotFoundError } from "../../../documents/server/domain/errors";
import type { NanobookModule } from "../../../nanobooks/server";
import type { CreateNanobookData } from "../../../nanobooks/server/domain/types";
import type { AgentActor, CreateDocumentInput, UpdateDocumentInput } from "./dto";
import { AgentScopeDeniedError } from "./errors";
import type { AgentAuditWriter } from "./ports/AgentAuditWriter";

export class AgentToolService {
  constructor(private readonly nanobooks: NanobookModule, private readonly documents: DocumentModule, private readonly audit: AgentAuditWriter) {}

  async listNanobooks(actor: AgentActor) {
    if (!this.has(actor, "nanobooks:read")) return Result.fail(new AgentScopeDeniedError("nanobooks:read"));
    return this.nanobooks.listNanobooks.execute(actor.actorId);
  }

  async getNanobook(actor: AgentActor, nanobookId: string) {
    if (!this.has(actor, "nanobooks:read")) return Result.fail(new AgentScopeDeniedError("nanobooks:read"));
    return this.nanobooks.requireNanobookAccess.execute(actor.actorId, nanobookId, "read");
  }

  async createNanobook(actor: AgentActor, input: Omit<CreateNanobookData, "id" | "ownerId"> & { id?: string }) {
    if (!this.has(actor, "nanobooks:write")) return Result.fail(new AgentScopeDeniedError("nanobooks:write"));
    const result = await this.nanobooks.createNanobook.execute(actor.actorId, input);
    if (result.isSuccess) await this.audit.write({ actorId: actor.actorId, oauthClientId: actor.oauthClientId, toolName: "create_nanobook", nanobookId: result.getValue().getId(), requestId: crypto.randomUUID() });
    return result;
  }

  async updateNanobook(actor: AgentActor, nanobookId: string, input: unknown) {
    if (!this.has(actor, "nanobooks:write")) return Result.fail(new AgentScopeDeniedError("nanobooks:write"));
    const result = await this.nanobooks.updateNanobook.execute(actor.actorId, nanobookId, input);
    if (result.isSuccess) await this.audit.write({ actorId: actor.actorId, oauthClientId: actor.oauthClientId, toolName: "update_nanobook", nanobookId, requestId: crypto.randomUUID() });
    return result;
  }

  async listDocuments(actor: AgentActor, nanobookId: string) {
    const access = await this.require(actor, nanobookId, "read");
    if (!access.isSuccess) return access;
    return Result.ok((await this.documents.getAllDocuments.execute(nanobookId)).map((document) => serializeEntry(document.parse())));
  }

  async getDocument(actor: AgentActor, nanobookId: string, path: string) {
    const access = await this.require(actor, nanobookId, "read");
    if (!access.isSuccess) return access;
    const document = await this.documents.getDocument.execute(nanobookId, path);
    return document
      ? Result.ok(serializeEntry(document.parse()))
      : Result.fail(new DocumentNotFoundError(path));
  }

  async createDocument(actor: AgentActor, nanobookId: string, input: CreateDocumentInput) {
    const access = await this.require(actor, nanobookId, "write");
    if (!access.isSuccess) return access;
    const result = await this.documents.createDocument.execute(nanobookId, { ...input, ownerId: actor.actorId, author: input.author ?? actor.actorId });
    if (result.isSuccess) await this.audit.write({ actorId: actor.actorId, oauthClientId: actor.oauthClientId, toolName: "create_document", nanobookId, documentId: result.getValue().getDocumentId().getValue(), requestId: crypto.randomUUID() });
    return result;
  }

  async updateDocument(actor: AgentActor, nanobookId: string, input: UpdateDocumentInput) {
    const access = await this.require(actor, nanobookId, "write");
    if (!access.isSuccess) return access;
    const result = await this.documents.updateDocument.execute(nanobookId, input, actor.actorId);
    if (result.isSuccess) await this.audit.write({ actorId: actor.actorId, oauthClientId: actor.oauthClientId, toolName: "update_document", nanobookId, documentId: input.id, requestId: crypto.randomUUID() });
    return result;
  }

  private has(actor: AgentActor, scope: "nanobooks:read" | "nanobooks:write") { return actor.scopes.includes(scope); }
  private async require(actor: AgentActor, nanobookId: string, permission: "read" | "write") {
    const scope = permission === "read" ? "nanobooks:read" : "nanobooks:write";
    if (!this.has(actor, scope)) return Result.fail(new AgentScopeDeniedError(scope));
    return this.nanobooks.requireNanobookAccess.execute(actor.actorId, nanobookId, permission);
  }
}
