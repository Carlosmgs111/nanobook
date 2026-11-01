import { describe, expect, it, vi } from "vitest";
import { Document } from "../../../documents/server/domain/Document";
import { DocumentCreated } from "../../../documents/server/domain/events/DocumentCreated";
import { DocumentUpdated } from "../../../documents/server/domain/events/DocumentUpdated";
import { DocumentDeleted } from "../../../documents/server/domain/events/DocumentDeleted";
import { InMemoryEventBus } from "../../../shared/infrastructure/InMemoryEventBus";
import type { DocumentModule } from "../../../documents/server";
import { NavigationModule } from "../index";

type NavigationDocuments = Pick<
  DocumentModule,
  "getAllDocuments"
>;

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
  it("reuses a built graph for repeated queries of the same nanobook", async () => {
    const execute = vi.fn(async () => [document("index", "book-a-root", "Book A")]);
    const documents: NavigationDocuments = {
      getAllDocuments: { execute },
    };
    const module = await NavigationModule.create(documents, new InMemoryEventBus());

    const first = await module.getNavigation("book-a", {
      rootPath: "index",
      basePath: "/n/book-a",
    });
    const second = await module.getNavigation("book-a", {
      rootPath: "index",
      basePath: "/n/book-a",
    });

    expect(first.getBreadcrumbs("index")[0]).toMatchObject({
      title: "Book A",
      href: "/n/book-a",
    });
    expect(second.getDocumentIdByPath("index")).toBe("book-a-root");
    expect(execute).toHaveBeenCalledExactlyOnceWith("book-a");
  });

  it("shares an in-progress graph build between concurrent queries", async () => {
    let resolveDocuments: (entries: ReturnType<typeof document>[]) => void;
    const pendingDocuments = new Promise<ReturnType<typeof document>[]>((resolve) => {
      resolveDocuments = resolve;
    });
    const execute = vi.fn(() => pendingDocuments);
    const documents: NavigationDocuments = {
      getAllDocuments: { execute },
    };
    const module = await NavigationModule.create(documents, new InMemoryEventBus());

    const first = module.getNavigation("book-a");
    const second = module.getNavigation("book-a");

    await Promise.resolve();
    expect(execute).toHaveBeenCalledExactlyOnceWith("book-a");
    resolveDocuments!([document("index", "book-a-root", "Book A")]);

    expect((await first).getDocumentIdByPath("index")).toBe("book-a-root");
    expect((await second).getDocumentIdByPath("index")).toBe("book-a-root");
  });

  it.each([DocumentCreated, DocumentUpdated, DocumentDeleted])(
    "rebuilds the cached graph for the affected nanobook on %s",
    async (Event) => {
      let title = "Before mutation";
      const execute = vi.fn(async () => [document("index", "book-a-root", title)]);
      const documents: NavigationDocuments = {
        getAllDocuments: { execute },
      };
      const eventBus = new InMemoryEventBus();
      const module = await NavigationModule.create(documents, eventBus);

      await module.getNavigation("book-a");
      title = "After mutation";
      const result = await eventBus.publish(new Event("doc-1", "book-a"));
      const navigation = await module.getNavigation("book-a", { rootPath: "index" });

      expect(result.isSuccess).toBe(true);
      expect(navigation.getBreadcrumbs("index")[0]).toMatchObject({
        title: "After mutation",
      });
      expect(execute).toHaveBeenCalledTimes(2);
    },
  );

  it("keeps concurrent navigation queries isolated by nanobook", async () => {
    const documents: NavigationDocuments = {
      getAllDocuments: {
        execute: async (id) => [document("index", `${id}-root`, id)],
      },
    };
    const module = await NavigationModule.create(documents, new InMemoryEventBus());
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
    const documents: NavigationDocuments = {
      getAllDocuments: { execute: async () => { throw new Error("unavailable"); } },
    };
    const bus = new InMemoryEventBus();
    await NavigationModule.create(documents, bus);
    expect((await bus.publish(new DocumentUpdated("doc", "book"))).isSuccess).toBe(false);
  });
});
