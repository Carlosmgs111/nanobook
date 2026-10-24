export interface AgentAuditEntry {
  actorId: string; oauthClientId: string; toolName: string; nanobookId: string;
  documentId?: string; requestId: string;
}

export interface AgentAuditWriter { write(entry: AgentAuditEntry): Promise<void>; }
