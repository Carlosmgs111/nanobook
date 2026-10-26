import { randomUUID } from "node:crypto";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { agentOperationAudit } from "../database/DrizzleAgentAuditSchema";
import type {
  AgentAuditEntry,
  AgentAuditWriter,
} from "../../application/ports/AgentAuditWriter";

export class DrizzleAgentAuditWriter implements AgentAuditWriter {
  constructor(private readonly database: LibSQLDatabase) {}
  async write(entry: AgentAuditEntry): Promise<void> {
    await this.database
      .insert(agentOperationAudit)
      .values({ id: randomUUID(), ...entry, occurredAt: new Date() });
  }
}
