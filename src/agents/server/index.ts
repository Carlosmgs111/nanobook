import type { DocumentModule } from "../../documents/server";
import type { NanobookModule } from "../../nanobooks/server";
import { AgentToolService } from "./application/AgentToolService";
import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import { DrizzleAgentAuditWriter } from "./infrastructure/audit/DrizzleAgentAuditWriter";

export { AgentToolService } from "./application/AgentToolService";
export type { AgentActor, CreateDocumentInput, UpdateDocumentInput } from "./application/dto";
export { AgentScopeDeniedError } from "./application/errors";

export class AgentModule {
  private constructor(public readonly tools: AgentToolService) {}

  static create(nanobooks: NanobookModule, documents: DocumentModule): AgentModule {
    return new AgentModule(new AgentToolService(nanobooks, documents, new DrizzleAgentAuditWriter(db)));
  }
}
