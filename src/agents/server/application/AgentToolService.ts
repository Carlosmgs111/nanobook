import { Result } from "../../../shared/domain/Result";
import { Subject, type Authorizer } from "../../../authorization/server";
import { serializeEntry } from "../../../documents/server/application/dto/SerializedEntry";
import { DocumentAccessDeniedError, DocumentNotFoundError } from "../../../documents/server/domain/errors";
import type { NanobookModule } from "../../../nanobooks/server";
import type { CreateNanobookData } from "../../../nanobooks/server/domain/types";
import type {
  AgentActor,
  CreateDocumentInput,
  UpdateDocumentInput,
} from "./dto";
import { AgentScopeDeniedError } from "./errors";
import type { AgentAuditWriter } from "./ports/AgentAuditWriter";
import type { MarkdownBlockAdvisor, MarkdownBlockIssue } from "./ports/MarkdownBlockAdvisor";

export class AgentToolService {
  constructor(
    private readonly nanobooks: NanobookModule,
    private readonly audit: AgentAuditWriter,
    private readonly blocks: MarkdownBlockAdvisor,
    private readonly authorizer: Authorizer
  ) {}

  /** Guía de autoría de bloques; texto estático, solo exige poder leer. */
  async getMarkdownBlocksGuide(actor: AgentActor) {
    if (!this.has(actor, "nanobooks:read"))
      return Result.fail(new AgentScopeDeniedError("nanobooks:read"));
    return Result.ok(this.blocks.guide());
  }

  /** Valida los bloques de un contenido sin guardarlo. */
  async validateMarkdownBlocks(actor: AgentActor, content: string) {
    if (!this.has(actor, "nanobooks:read"))
      return Result.fail(new AgentScopeDeniedError("nanobooks:read"));
    const issues = this.blocks.validate(content);
    return Result.ok({ valid: issues.length === 0, issues });
  }

  /**
   * Revisión del contenido que el propio agente acaba de enviar; no accede a
   * datos del usuario, así que no requiere un permiso adicional.
   */
  inspectBlocks(content: string): readonly MarkdownBlockIssue[] {
    return this.blocks.validate(content);
  }

  async listNanobooks(actor: AgentActor) {
    if (!this.has(actor, "nanobooks:read"))
      return Result.fail(new AgentScopeDeniedError("nanobooks:read"));
    return this.nanobooks.listNanobooks.execute(actor.actorId);
  }

  async getNanobook(actor: AgentActor, nanobookId: string) {
    if (!this.has(actor, "nanobooks:read"))
      return Result.fail(new AgentScopeDeniedError("nanobooks:read"));
    const access = await this.access(actor, nanobookId, "read");
    if (!access.isSuccess) return Result.fail(access.getError());
    return this.nanobooks.getNanobookById.execute(nanobookId);
  }

  async createNanobook(
    actor: AgentActor,
    input: Omit<CreateNanobookData, "id" | "ownerId"> & { id?: string }
  ) {
    if (!this.has(actor, "nanobooks:write"))
      return Result.fail(new AgentScopeDeniedError("nanobooks:write"));
    const result = await this.nanobooks.createNanobook.execute(
      actor.actorId,
      input
    );
    if (result.isSuccess)
      await this.audit.write({
        actorId: actor.actorId,
        oauthClientId: actor.oauthClientId,
        toolName: "create_nanobook",
        nanobookId: result.getValue().getId(),
        requestId: crypto.randomUUID(),
      });
    return result;
  }

  async updateNanobook(actor: AgentActor, nanobookId: string, input: unknown) {
    if (!this.has(actor, "nanobooks:write"))
      return Result.fail(new AgentScopeDeniedError("nanobooks:write"));
    const result = await this.nanobooks.updateNanobook.execute(
      actor.actorId,
      nanobookId,
      input
    );
    if (result.isSuccess)
      await this.audit.write({
        actorId: actor.actorId,
        oauthClientId: actor.oauthClientId,
        toolName: "update_nanobook",
        nanobookId,
        requestId: crypto.randomUUID(),
      });
    return result;
  }

  async listDocuments(actor: AgentActor, nanobookId: string) {
    const access = await this.require(actor, nanobookId, "read");
    if (!access.isSuccess) return Result.fail(access.getError());
    const documents = await this.nanobooks.documentModule.listReadableDocuments.execute(nanobookId, {
      userId: actor.actorId,
    });
    return Result.ok(documents.map((document) => serializeEntry(document.parse())));
  }

  async getDocument(actor: AgentActor, nanobookId: string, path: string) {
    const access = await this.require(actor, nanobookId, "read");
    if (!access.isSuccess) return Result.fail(access.getError());
    const read = await this.nanobooks.documentModule.readDocument.execute({
      nanobookId,
      path,
      viewer: {
        userId: async () => actor.actorId,
        // Un agente no tiene cómo superar el desafío de contraseña.
        grantFor: () => undefined,
      },
    });
    if (read.kind === "not-found") return Result.fail(new DocumentNotFoundError(path));
    if (read.kind === "challenge") {
      return Result.fail(new DocumentAccessDeniedError(read.document.getDocumentId().getValue()));
    }
    return Result.ok(serializeEntry(read.document.parse()));
  }

  async createDocument(
    actor: AgentActor,
    nanobookId: string,
    input: CreateDocumentInput
  ) {
    const access = await this.require(actor, nanobookId, "write");
    if (!access.isSuccess) return Result.fail(access.getError());
    const result = await this.nanobooks.documentModule.createDocument.execute(
      nanobookId,
      { ...input, author: input.author ?? actor.actorId },
      actor.actorId,
    );
    if (result.isSuccess)
      await this.audit.write({
        actorId: actor.actorId,
        oauthClientId: actor.oauthClientId,
        toolName: "create_document",
        nanobookId,
        documentId: result.getValue().getDocumentId().getValue(),
        requestId: crypto.randomUUID(),
      });
    return result;
  }

  async updateDocument(
    actor: AgentActor,
    nanobookId: string,
    input: UpdateDocumentInput
  ) {
    const access = await this.require(actor, nanobookId, "write");
    if (!access.isSuccess) return Result.fail(access.getError());
    const result = await this.nanobooks.documentModule.updateDocument.execute(
      nanobookId,
      input,
      actor.actorId
    );
    if (result.isSuccess)
      await this.audit.write({
        actorId: actor.actorId,
        oauthClientId: actor.oauthClientId,
        toolName: "update_document",
        nanobookId,
        documentId: input.id,
        requestId: crypto.randomUUID(),
      });
    return result;
  }

  private has(actor: AgentActor, scope: "nanobooks:read" | "nanobooks:write") {
    return actor.scopes.includes(scope);
  }
  private async require(
    actor: AgentActor,
    nanobookId: string,
    permission: "read" | "write"
  ) {
    const scope = permission === "read" ? "nanobooks:read" : "nanobooks:write";
    if (!this.has(actor, scope))
      return Result.fail(new AgentScopeDeniedError(scope));
    return this.access(actor, nanobookId, permission);
  }

  private access(actor: AgentActor, nanobookId: string, action: "read" | "write") {
    return this.authorizer.require({
      subject: Subject.of(actor.actorId),
      action,
      resource: { type: "nanobook", id: nanobookId },
    });
  }
}
