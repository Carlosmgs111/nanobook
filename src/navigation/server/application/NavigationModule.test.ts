import { describe, expect, it, vi } from "vitest";
import { Document } from "../../../documents/server/domain/Document";
import { DocumentCreated } from "../../../documents/server/domain/events/DocumentCreated";
import { DocumentUpdated } from "../../../documents/server/domain/events/DocumentUpdated";
import { DocumentDeleted } from "../../../documents/server/domain/events/DocumentDeleted";
import { InMemoryEventBus } from "../../../shared/infrastructure/InMemoryEventBus";
import type { DocumentProvider } from "../domain/ports/DocumentProvider";
import { NavigationModule } from "../index";

function document(path: string, id: string, title = path) {
  return Document.create(
    path,
    {
      id,
      title,
      description: path,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    "# Document"
  ).getValue();
}

describe("NavigationModule", () => {
  it.each([DocumentCreated, DocumentUpdated, DocumentDeleted])(
    "refreshes the affected nanobook on %s",
    async (Event) => {
      const provider: DocumentProvider = {
        getAll: vi.fn(async () => []),
        refresh: vi.fn(async () => []),
      };
      const eventBus = new InMemoryEventBus();
      await NavigationModule.create(provider, eventBus);
      const result = await eventBus.publish(new Event("doc-1", "book-a"));
      expect(result.isSuccess).toBe(true);
      expect(provider.refresh).toHaveBeenCalledExactlyOnceWith("book-a");
    },
  );

  it("keeps concurrent navigation queries isolated without retaining a tenant graph", async () => {
    const provider: DocumentProvider = {
      getAll: async (id) => [document("index", `${id}-root`, id)],
      refresh: async () => [],
    };
    const module = await NavigationModule.create(provider, new InMemoryEventBus());
    const [a, b] = await Promise.all([
      module.getNavigation("a", { rootPath: "index", basePath: "/n/a" }),
      module.getNavigation("b", { rootPath: "index", basePath: "/n/b" }),
    ]);
    expect(a.getBreadcrumbs("index")[0]).toMatchObject({ title: "a", href: "/n/a" });
    expect(b.getBreadcrumbs("index")[0]).toMatchObject({ title: "b", href: "/n/b" });
    expect(a.getDocumentIdByPath("index")).toBe("a-root");
    expect(b.getDocumentIdByPath("index")).toBe("b-root");
  });

  it("reports refresh failures through the event bus", async () => {
    const provider: DocumentProvider = {
      getAll: async () => [],
      refresh: async () => { throw new Error("unavailable"); },
    };
    const bus = new InMemoryEventBus();
    await NavigationModule.create(provider, bus);
    expect((await bus.publish(new DocumentUpdated("doc", "book"))).isSuccess).toBe(false);
  });
});
