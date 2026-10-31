import { describe, expect, it, vi } from "vitest";

import { Result } from "../../shared/domain/Result";
import { Nanobook } from "../../nanobooks/server/domain/Nanobook";
import { resolveNanobookRoute } from "./resolveNanobookRoute";

describe("resolveNanobookRoute", () => {
  const route = async (
    nanobook: Nanobook,
    session: { id: string } | null,
    permission: "read" | "write",
  ) => {
    const app = {
      nanobookModule: {
        getNanobookBySlug: {
          execute: vi.fn().mockResolvedValue(Result.ok(nanobook)),
        },
      },
      authServerModule: {
        getSession: vi.fn().mockResolvedValue(session),
      },
    } as never;

    return resolveNanobookRoute(
      app,
      new Request("https://nanobook.test/n/manual"),
      "manual",
      permission,
    );
  };

  it("returns the resolved nanobook and session actor after authorizing a read", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
    }).getValue();
    const result = await route(nanobook, { id: "owner-1" }, "read");

    expect(result).toEqual({ nanobook, userId: "owner-1" });
  });

  it("allows an anonymous read of a public nanobook", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
      visibility: "public",
    }).getValue();

    const result = await route(nanobook, null, "read");

    expect(result).toEqual({ nanobook, userId: undefined });
  });

  it("hides a private nanobook from a non-owner", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
    }).getValue();

    const result = await route(nanobook, { id: "visitor" }, "read");

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(404);
  });

  it("requires a session before allowing a write", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
      visibility: "public",
    }).getValue();

    const result = await route(nanobook, null, "write");

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});
