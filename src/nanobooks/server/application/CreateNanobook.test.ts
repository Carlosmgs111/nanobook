import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { CreateNanobook } from "./CreateNanobook";

describe("CreateNanobook", () => {
  it("creates a collection and its root through the creation store", async () => {
    const createWithRoot = vi.fn().mockResolvedValue(Result.ok());
    const initializeRoot = vi.fn().mockResolvedValue(undefined);
    const result = await new CreateNanobook(
      { createWithRoot },
      initializeRoot,
    ).execute("owner-1", {
      slug: "architecture",
      name: "Architecture",
      visibility: "private",
    });

    expect(result.isSuccess).toBe(true);
    expect(createWithRoot).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "owner-1",
        slug: "architecture",
      }),
      initializeRoot,
    );
  });

  it("propagates creation store failures", async () => {
    const failure = new Error("creation failed");
    const createWithRoot = vi.fn().mockResolvedValue(Result.fail(failure));

    const result = await new CreateNanobook(
      { createWithRoot },
      vi.fn(),
    ).execute("owner-1", {
      slug: "atomic",
      name: "Atomic",
      visibility: "private",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBe(failure);
  });
});
