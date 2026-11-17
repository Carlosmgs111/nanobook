import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { createMarkdownBlockAdvisor } from "../../../application/server/createMarkdownBlockAdvisor";
import type { Authorizer } from "../../../authorization/server";
import type { NanobookModule } from "../../../nanobooks/server";
import type { AgentActor } from "./dto";
import { AgentToolService } from "./AgentToolService";

const actor: AgentActor = { actorId: "dueño", oauthClientId: "claude", scopes: ["nanobooks:write"] };

describe("AgentToolService writes", () => {
  it("creates documents on behalf of the actor without sending an owner", async () => {
    const created = { getDocumentId: () => ({ getValue: () => "doc-1" }) };
    const execute = vi.fn().mockResolvedValue(Result.ok(created));
    const nanobooks = {
      documentModule: { createDocument: { execute } },
    } as unknown as NanobookModule;
    const authorizer = { require: vi.fn().mockResolvedValue(Result.ok()) } as unknown as Authorizer;
    const tools = new AgentToolService(nanobooks, { write: vi.fn() }, createMarkdownBlockAdvisor(), authorizer);

    await tools.createDocument(actor, "book-a", {
      id: "doc-1", path: "guia", title: "Guía", description: "d", content: "# Guía",
    } as never);

    const [nanobookId, input, actorId] = execute.mock.calls[0];
    expect(nanobookId).toBe("book-a");
    expect(input).not.toHaveProperty("ownerId");
    expect(input.author).toBe("dueño");
    expect(actorId).toBe("dueño");
  });
});
