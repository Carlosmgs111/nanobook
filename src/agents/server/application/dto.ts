export interface AgentActor {
  actorId: string;
  oauthClientId: string;
  scopes: readonly string[];
}

export interface CreateDocumentInput {
  path: string; title: string; description: string; content: string;
  author?: string; cover?: string; tags?: string[]; draft?: boolean; position?: number;
}

export interface UpdateDocumentInput extends CreateDocumentInput {
  id: string; expectedRevision?: number;
}
