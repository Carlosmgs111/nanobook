// src/spreadsheets/browser/canSaveSpreadsheet.test.ts
import { describe, expect, it, vi } from "vitest";
import { canSaveSpreadsheet } from "./canSaveSpreadsheet";

const base = { nanobookId: "book", documentPath: "doc" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("canSaveSpreadsheet", () => {
  it("allows without calling fetch when the page already knows the session", async () => {
    const fetcher = vi.fn();
    expect(await canSaveSpreadsheet(base, fetcher)).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("allows the owner", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ user: { id: "u1", name: "A", email: "a@b.c" } }));
    expect(await canSaveSpreadsheet({ ...base, ownerId: "u1" }, fetcher)).toBe(true);
    expect(fetcher).toHaveBeenCalledWith("/api/auth/get-session", { credentials: "include" });
  });

  it("denies another user", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ user: { id: "u2" } }));
    expect(await canSaveSpreadsheet({ ...base, ownerId: "u1" }, fetcher)).toBe(false);
  });

  it.each([
    ["empty payload", () => json({})],
    ["null user", () => json({ user: null })],
    ["401", () => json({ user: { id: "u1" } }, 401)],
    ["null body", () => json(null)],
  ])("denies anonymous visitors (%s)", async (_name, response) => {
    const fetcher = vi.fn().mockResolvedValue(response());
    expect(await canSaveSpreadsheet({ ...base, ownerId: "u1" }, fetcher)).toBe(false);
  });

  it("denies when fetch rejects", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await canSaveSpreadsheet({ ...base, ownerId: "u1" }, fetcher)).toBe(false);
  });
});
