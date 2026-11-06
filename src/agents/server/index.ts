import type { NanobookModule } from "../../nanobooks/server";
import { AgentToolService } from "./application/AgentToolService";
import type { MarkdownBlockAdvisor } from "./application/ports/MarkdownBlockAdvisor";
import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import { DrizzleAgentAuditWriter } from "./infrastructure/audit/DrizzleAgentAuditWriter";

export { AgentToolService } from "./application/AgentToolService";
export type {
  AgentActor,
  CreateDocumentInput,
  UpdateDocumentInput,
} from "./application/dto";
export { AgentScopeDeniedError } from "./application/errors";
export type {
  MarkdownBlockAdvisor,
  MarkdownBlockIssue,
} from "./application/ports/MarkdownBlockAdvisor";

export class AgentModule {
  private constructor(public readonly tools: AgentToolService) {}

  static create(
    nanobooks: NanobookModule,
    blocks: MarkdownBlockAdvisor
  ): AgentModule {
    return new AgentModule(
      new AgentToolService(
        nanobooks,
        new DrizzleAgentAuditWriter(db),
        blocks
      )
    );
  }
}
