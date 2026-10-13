import { describe, expect, it, vi } from "vitest";

import { Nanobook } from "../../nanobooks/server";
import { resolveLegacyRoute } from "./resolveLegacyRoute";
import type { Application } from "./Application";

describe("resolveLegacyRoute", () => {
  it("redirects an authorized legacy URL to the canonical nanobook URL", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
      visibility: "public",
    }).getValue();
    const app = {
      resolveNanobookAlias: vi.fn().mockResolvedValue({
        legacyPath: "guide/intro",
        nanobookId: "book-1",
        targetPath: "intro",
      }),
      forNanobook: vi.fn().mockResolvedValue({ nanobook }),
      authServerModule: { getSession: vi.fn().mockResolvedValue(null) },
    } as unknown as Application;

    const response = await resolveLegacyRoute(
      app,
      new Request("https://nanobook.test/guide/intro"),
      "guide/intro",
      "read",
    );

    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("https://nanobook.test/n/manual/intro");
  });

  it("hides a private legacy URL from anonymous readers", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "private-manual",
      name: "Private Manual",
      visibility: "private",
    }).getValue();
    const app = {
      resolveNanobookAlias: vi.fn().mockResolvedValue({
        legacyPath: "private",
        nanobookId: "book-1",
        targetPath: "index",
      }),
      forNanobook: vi.fn().mockResolvedValue({ nanobook }),
      authServerModule: { getSession: vi.fn().mockResolvedValue(null) },
    } as unknown as Application;

    const response = await resolveLegacyRoute(
      app,
      new Request("https://nanobook.test/private"),
      "private",
      "read",
    );

    expect(response?.status).toBe(404);
  });
});
