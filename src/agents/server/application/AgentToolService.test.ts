import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import type { NanobookModule } from "../../../nanobooks/server";
import { AgentToolService } from "./AgentToolService";
import type { MarkdownBlockAdvisor } from "./ports/MarkdownBlockAdvisor";

const reader = { actorId: "user-sensitive-id", oauthClientId: "codex-client", scopes: ["nanobooks:read"] };
const noScopes = { ...reader, scopes: [] };

function advisor(issues: ReturnType<MarkdownBlockAdvisor["validate"]> = []): MarkdownBlockAdvisor {
  return { guide: () => "GUÍA", validate: vi.fn().mockReturnValue(issues) };
}

function service(blocks: MarkdownBlockAdvisor, listNanobooks = vi.fn().mockResolvedValue(Result.ok([]))) {
  return new AgentToolService(
    { listNanobooks: { execute: listNanobooks } } as unknown as NanobookModule,
    { write: vi.fn() },
    blocks,
  );
}

describe("AgentToolService", () => {
  it("lists the actor's nanobooks without logging the delegated identity", async () => {
    const listNanobooks = vi.fn().mockResolvedValue(Result.ok([]));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await service(advisor(), listNanobooks).listNanobooks(reader);

    expect(result.isSuccess).toBe(true);
    expect(listNanobooks).toHaveBeenCalledWith("user-sensitive-id");
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  describe("markdown blocks", () => {
    it("serves the guide to an actor that can read", async () => {
      const result = await service(advisor()).getMarkdownBlocksGuide(reader);
      expect(result.getValue()).toBe("GUÍA");
    });

    it("denies the guide and the validation without the read scope", async () => {
      const tools = service(advisor());
      expect((await tools.getMarkdownBlocksGuide(noScopes)).isSuccess).toBe(false);
      expect((await tools.validateMarkdownBlocks(noScopes, "x")).isSuccess).toBe(false);
    });

    it("reports a document as valid only when no block has problems", async () => {
      const issue = { block: "price-chart", line: 3, path: "series", message: "mal" };

      const valid = await service(advisor()).validateMarkdownBlocks(reader, "x");
      const invalid = await service(advisor([issue])).validateMarkdownBlocks(reader, "x");

      expect(valid.getValue()).toEqual({ valid: true, issues: [] });
      expect(invalid.getValue()).toEqual({ valid: false, issues: [issue] });
    });

    it("inspects content without requiring a scope, since it only reads what the caller sent", () => {
      const blocks = advisor();
      service(blocks).inspectBlocks("contenido");
      expect(blocks.validate).toHaveBeenCalledWith("contenido");
    });
  });
});
