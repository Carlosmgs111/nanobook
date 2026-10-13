import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { CreateNanobook } from "./CreateNanobook";

describe("CreateNanobook", () => {
  it("creates a nanobook through the repository", async () => {
    const create = vi.fn().mockResolvedValue(Result.ok());
    const result = await new CreateNanobook(
      { create },
    ).execute("owner-1", {
      slug: "architecture",
      name: "Architecture",
      visibility: "private",
    });

    expect(result.isSuccess).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "owner-1",
        slug: "architecture",
      }),
    );
  });

  it("propagates repository failures", async () => {
    const failure = new Error("creation failed");
    const create = vi.fn().mockResolvedValue(Result.fail(failure));

    const result = await new CreateNanobook(
      { create },
    ).execute("owner-1", {
      slug: "atomic",
      name: "Atomic",
      visibility: "private",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBe(failure);
  });
});
