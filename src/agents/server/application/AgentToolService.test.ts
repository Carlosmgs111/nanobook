import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import type { DocumentModule } from "../../../documents/server";
import type { NanobookModule } from "../../../nanobooks/server";
import { AgentToolService } from "./AgentToolService";

describe("AgentToolService", () => {
  it("lists the actor's nanobooks without logging the delegated identity", async () => {
    const listNanobooks = vi.fn().mockResolvedValue(Result.ok([]));
    const service = new AgentToolService(
      { listNanobooks: { execute: listNanobooks } } as unknown as NanobookModule,
      {} as DocumentModule,
      { write: vi.fn() },
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await service.listNanobooks({
      actorId: "user-sensitive-id",
      oauthClientId: "codex-client",
      scopes: ["nanobooks:read"],
    });

    expect(result.isSuccess).toBe(true);
    expect(listNanobooks).toHaveBeenCalledWith("user-sensitive-id");
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
