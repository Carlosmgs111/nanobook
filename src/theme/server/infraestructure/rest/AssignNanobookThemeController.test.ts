import { describe, expect, it } from "vitest";
import { createAuthorizer } from "../../../../authorization/server";
import { Nanobook } from "../../../../nanobooks/server/domain/Nanobook";
import { NanobookAccessPolicy } from "../../../../nanobooks/server/application/NanobookAccessPolicy";
import { SetNanobookTheme } from "../../../../nanobooks/server/application/SetNanobookTheme";
import { InMemoryNanobookRepository } from "../../../../nanobooks/server/infraestructure/repository/InMemoryNanobookRepository";
import { Result } from "../../../../shared/domain/Result";
import { AssignNanobookTheme } from "../../application/AssignNanobookTheme";
import { AssignNanobookThemeController } from "./AssignNanobookThemeController";

const reference = { kind: "official", id: "nanobook" } as const;

function setup() {
  const repository = new InMemoryNanobookRepository([
    Nanobook.create({ id: "priv", ownerId: "owner", slug: "priv", name: "Priv" }).getValue(),
    Nanobook.create({ id: "pub", ownerId: "owner", slug: "pub", name: "Pub", visibility: "public" }).getValue(),
  ]);
  const cache = { getOrLoad: async (_s: string, load: () => any) => load(), replace: async () => undefined, remove: async () => undefined };
  const setTheme = new SetNanobookTheme(repository, cache as any, createAuthorizer([new NanobookAccessPolicy(repository)]));
  const themes = { execute: async (_user: string, ref: typeof reference) => Result.ok(ref) };
  return new AssignNanobookThemeController(new AssignNanobookTheme(themes as any, setTheme));
}

const context = (user: string, nanobookId: string) => ({
  request: new Request("http://localhost/api", { method: "PUT", body: JSON.stringify({ reference }) }),
  params: { nanobookId },
  locals: { currentUserId: user },
}) as any;

describe("AssignNanobookThemeController", () => {
  it("answers 404 to a stranger on a private nanobook and 403 on a public one", async () => {
    const controller = setup();
    expect((await controller.handle(context("stranger", "priv"))).status).toBe(404);
    expect((await controller.handle(context("stranger", "pub"))).status).toBe(403);
    expect((await controller.handle(context("stranger", "missing"))).status).toBe(404);
  });

  it("lets the owner assign the theme", async () => {
    expect((await setup().handle(context("owner", "priv"))).status).toBe(204);
  });
});
