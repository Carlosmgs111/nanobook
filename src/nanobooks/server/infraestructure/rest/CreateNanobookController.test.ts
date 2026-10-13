import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { Nanobook } from "../../domain/Nanobook";
import { CreateNanobookController } from "./CreateNanobookController";

describe("CreateNanobookController", () => {
  it("generates the collection identity on the server", async () => {
    const nanobook = Nanobook.create({
      id: "server-id",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
    }).getValue();
    const execute = vi.fn().mockResolvedValue(Result.ok(nanobook));
    const controller = new CreateNanobookController({ execute } as never);

    const response = await controller.handle({
      request: new Request("https://nanobook.test/api/nanobooks", {
        method: "POST",
        body: JSON.stringify({
          id: "forged-id",
          slug: "manual",
          name: "Manual",
          visibility: "private",
          settings: { provider: "github" },
        }),
      }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(response.status).toBe(201);
    expect(execute).toHaveBeenCalledWith("owner-1", {
      slug: "manual",
      name: "Manual",
      visibility: "private",
      settings: { provider: "github" },
    });
    expect(execute.mock.calls[0]?.[1]).not.toHaveProperty("id");
  });
});
