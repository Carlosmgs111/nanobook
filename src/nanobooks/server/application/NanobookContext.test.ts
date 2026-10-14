import { describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
  GITHUB_TOKEN: undefined,
  CACHE_BACKEND: "memory",
  REDIS_URL: undefined,
  INVALIDATE_TOKEN: undefined,
}), { virtual: true });

import { Document } from "../../../documents/server/domain/Document";
import { DocumentCreated } from "../../../documents/server/domain/events/DocumentCreated";
import { NavigationModule } from "../../../navigation/server";
import { Nanobook } from "../domain/Nanobook";
import { InMemoryEventBus } from "../../../shared/infrastructure/InMemoryEventBus";
import { NanobookContext } from "./NanobookContext";

function book(id: string, slug: string) {
  return Nanobook.create({
    id,
    ownerId: "owner-1",
    slug,
    name: slug,
  }).getValue();
}

function document(path: string, id: string) {
  return Document.create(path, {
    id,
    title: id,
    description: id,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  }, "# Document").getValue();
}

describe("NanobookContext", () => {
  it("keeps equal paths and refresh events isolated between contexts", async () => {
    const rootA = document("index", "root-a");
    const childA = document("guide", "guide-a");
    const rootB = document("index", "root-b");
    const childB = document("guide", "guide-b");
    let documentsA = [rootA, childA];
    let documentsB = [rootB, childB];
    const busA = new InMemoryEventBus();
    const busB = new InMemoryEventBus();
    const navigationA = await NavigationModule.create(
      { getAll: async () => documentsA },
      busA,
      { rootPath: "index" },
    );
    const navigationB = await NavigationModule.create(
      { getAll: async () => documentsB },
      busB,
      { rootPath: "index" },
    );
    const publishing = { unregisterEventHandlers: vi.fn() } as any;
    const contextA = new NanobookContext(book("book-a", "a"), {} as any, navigationA, publishing, busA);
    const contextB = new NanobookContext(book("book-b", "b"), {} as any, navigationB, publishing, busB);

    documentsA = [...documentsA, document("guide/details", "details-a")];
    await busA.publish(new DocumentCreated("details-a"));

    expect(contextA.documentModule).not.toBe(contextB.documentModule);
    expect(navigationA.navigationService.getImmediateChildren("guide")).toHaveLength(1);
    expect(navigationB.navigationService.getImmediateChildren("guide")).toHaveLength(0);

    contextA.close();
    expect(publishing.unregisterEventHandlers).toHaveBeenCalledTimes(1);
  });
});
