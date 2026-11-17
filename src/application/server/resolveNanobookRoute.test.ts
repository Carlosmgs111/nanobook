import { describe, expect, it, vi } from "vitest";

import { Result } from "../../shared/domain/Result";
import { createAuthorizer } from "../../authorization/server";
import { NanobookAccessPolicy } from "../../nanobooks/server/application/NanobookAccessPolicy";
import { Nanobook } from "../../nanobooks/server/domain/Nanobook";
import { InMemoryNanobookRepository } from "../../nanobooks/server/infraestructure/repository/InMemoryNanobookRepository";
import { resolveNanobookRoute } from "./resolveNanobookRoute";

function authorizerFor(nanobook: Nanobook) {
  return createAuthorizer([new NanobookAccessPolicy(new InMemoryNanobookRepository([nanobook]))]);
}

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
      authorizer: authorizerFor(nanobook),
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
    const user = { id: "owner-1", name: "Ada", email: "ada@example.com" };
    const result = await route(nanobook, user, "read");

    expect(result).toEqual({ nanobook, user });
  });

  it("reads a session only after resolving that a private nanobook needs it", async () => {
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
      authorizer: authorizerFor(nanobook),
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

    expect(started).toEqual(["nanobook"]);

    resolveNanobook?.(Result.ok(nanobook));
    await new Promise((resolve) => setTimeout(resolve));

    expect(started).toEqual(["nanobook", "session"]);

    const user = { id: "owner-1", name: "Ada", email: "ada@example.com" };
    resolveSession?.(user);
    await expect(pending).resolves.toEqual({ nanobook, user });
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
      authorizer: authorizerFor(nanobook),
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

    expect(result).toEqual({ nanobook, user: null });
  });

  it("does not read a session before serving a public nanobook", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
      visibility: "public",
    }).getValue();
    const getSession = vi.fn().mockResolvedValue({ id: "owner-1" });
    const app = {
      nanobookModule: {
        getNanobookBySlug: { execute: vi.fn().mockResolvedValue(Result.ok(nanobook)) },
      },
      authServerModule: { getSession },
      authorizer: authorizerFor(nanobook),
    } as never;

    const result = await resolveNanobookRoute(
      app,
      new Request("https://nanobook.test/n/manual"),
      "manual",
      "read",
    );

    expect(result).toEqual({ nanobook, user: null });
    expect(getSession).not.toHaveBeenCalled();
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

  it("allows the owner to write", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
    }).getValue();
    const user = { id: "owner-1", name: "Ada", email: "ada@example.com" };

    expect(await route(nanobook, user, "write")).toEqual({ nanobook, user });
  });

  it("answers 403 to a non-owner writing on a public nanobook", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
      visibility: "public",
    }).getValue();

    const result = await route(nanobook, { id: "visitor" }, "write");

    expect((result as Response).status).toBe(403);
  });

  it("answers 404 to a non-owner writing on a private nanobook", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
    }).getValue();

    const result = await route(nanobook, { id: "visitor" }, "write");

    expect((result as Response).status).toBe(404);
  });

  it("answers an anonymous write identically whether the slug exists or not, resolving the session once", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
    }).getValue();
    const build = (found: Nanobook | null) => {
      const getSession = vi.fn().mockResolvedValue(null);
      const app = {
        nanobookModule: {
          getNanobookBySlug: { execute: vi.fn().mockResolvedValue(Result.ok(found)) },
        },
        authServerModule: { getSession },
        authorizer: authorizerFor(nanobook),
      } as never;
      return { app, getSession };
    };
    const request = () => new Request("https://nanobook.test/n/manual");

    const missing = build(null);
    const existing = build(nanobook);
    const missingResponse = (await resolveNanobookRoute(missing.app, request(), "manual", "write")) as Response;
    const existingResponse = (await resolveNanobookRoute(existing.app, request(), "manual", "write")) as Response;

    expect(missingResponse.status).toBe(401);
    expect(existingResponse.status).toBe(401);
    expect(await missingResponse.text()).toBe("Autenticación requerida");
    expect(await existingResponse.text()).toBe("Autenticación requerida");
    expect(missing.getSession).toHaveBeenCalledTimes(1);
    expect(existing.getSession).toHaveBeenCalledTimes(1);
  });

  it("resolves the session once when an authenticated user writes", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
    }).getValue();
    const user = { id: "owner-1", name: "Ada", email: "ada@example.com" };
    const getSession = vi.fn().mockResolvedValue(user);
    const app = {
      nanobookModule: {
        getNanobookBySlug: { execute: vi.fn().mockResolvedValue(Result.ok(nanobook)) },
      },
      authServerModule: { getSession },
      authorizer: authorizerFor(nanobook),
    } as never;

    const result = await resolveNanobookRoute(
      app,
      new Request("https://nanobook.test/n/manual"),
      "manual",
      "write",
    );

    expect(result).toEqual({ nanobook, user });
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
