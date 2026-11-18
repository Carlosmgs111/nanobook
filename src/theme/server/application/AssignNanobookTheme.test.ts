import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { AssignNanobookTheme } from "./AssignNanobookTheme";

describe("AssignNanobookTheme", () => {
  it("does not mutate the nanobook when the reference is not assignable", async () => {
    const themes = { execute: vi.fn().mockResolvedValue(Result.fail(new Error("forbidden"))) };
    const nanobooks = vi.fn();
    const result = await new AssignNanobookTheme(themes, nanobooks).execute(
      "owner",
      "book",
      { kind: "custom", id: "foreign" },
    );
    expect(result.isSuccess).toBe(false);
    expect(nanobooks).not.toHaveBeenCalled();
  });

  it("forwards the accepted normalized reference exactly once", async () => {
    const normalized = { kind: "official", id: "nanobook" } as const;
    const themes = { execute: vi.fn().mockResolvedValue(Result.ok(normalized)) };
    const nanobooks = vi.fn().mockResolvedValue(Result.ok({}));
    const result = await new AssignNanobookTheme(themes, nanobooks).execute(
      "owner",
      "book",
      { kind: "official", id: "nanobook" },
    );
    expect(result.isSuccess).toBe(true);
    expect(nanobooks).toHaveBeenCalledOnce();
    expect(nanobooks).toHaveBeenCalledWith("owner", "book", normalized);
  });
});
