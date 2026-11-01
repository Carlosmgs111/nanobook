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

  it("starts reading the session before the nanobook lookup completes", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
    }).getValue();
    const started: string[] = [];
    let resolveNanobook: ((result: Result<never, Nanobook>) => void) | undefined;
    let resolveSession: ((session: { id: string }) => void) | undefined;
    const app = {
      nanobookModule: {
        getNanobookBySlug: {
          execute: () =>
            new Promise<Result<never, Nanobook>>((resolve) => {
              started.push("nanobook");
              resolveNanobook = resolve;
            }),
        },
      },
      authServerModule: {
        getSession: () =>
          new Promise<{ id: string }>((resolve) => {
            started.push("session");
            resolveSession = resolve;
          }),
      },
    } as never;

    const pending = resolveNanobookRoute(
      app,
      new Request("https://nanobook.test/n/manual"),
      "manual",
      "read",
    );

    await Promise.resolve();

    expect(started).toEqual(["nanobook", "session"]);

    resolveNanobook?.(Result.ok(nanobook));
    resolveSession?.({ id: "owner-1" });
    await expect(pending).resolves.toEqual({ nanobook, userId: "owner-1" });
  });

  it("reports nanobook and session durations independently", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
    }).getValue();
    const timings: Record<string, number> = {};
    const app = {
      nanobookModule: {
        getNanobookBySlug: {
          execute: async () => Result.ok(nanobook),
        },
      },
      authServerModule: {
        getSession: async () => ({ id: "owner-1" }),
      },
    } as never;

    await resolveNanobookRoute(
      app,
      new Request("https://nanobook.test/n/manual"),
      "manual",
      "read",
      (name, duration) => {
        timings[name] = duration;
      },
    );

    expect(timings["route-nanobook"]).toEqual(expect.any(Number));
    expect(timings["route-session"]).toEqual(expect.any(Number));
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
