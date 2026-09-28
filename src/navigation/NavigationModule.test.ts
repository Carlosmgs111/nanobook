import { describe, expect, it } from "vitest";
import { Document } from "../document/domain/Document";
import { DocumentCreated } from "../document/domain/events/DocumentCreated";
import { DocumentUpdated } from "../document/domain/events/DocumentUpdated";
import { DocumentPath } from "../document/domain/DocumentPath";
import { InMemoryEventBus } from "../shared/infraestructure/InMemoryEventBus";
import type { DocumentProvider } from "./domain/ports/DocumentProvider";
import { NavigationModule } from "./index";

function document(path: string, id: string, title = path) {
  return Document.create(
    path,
    {
      id,
      title,
      description: path,
      date: new Date("2026-01-01"),
    },
    "# Document"
  ).getValue();
}

describe("NavigationModule", () => {
  it("rebuilds the graph when a document is created", async () => {
    const root = document("index", "doc-root", "Home");
    const section = document("guides/index", "doc-guides", "Guides");
    const child = document("guides/cache", "doc-cache", "Cache");
    let documents = [root, section];
    const provider: DocumentProvider = { getAll: async () => documents };
    const eventBus = new InMemoryEventBus();
    const module = await NavigationModule.create(provider, eventBus);

    documents = [root, section, child];
    const result = await eventBus.publish(new DocumentCreated("doc-cache"));

    expect(result.isSuccess).toBe(true);
    expect(
      module.navigationService.getImmediateChildren(
        DocumentPath.create("guides/index").getValue()
      )
    ).toEqual([
      expect.objectContaining({ id: "doc-cache", path: "guides/cache" }),
    ]);
  });

  it("rebuilds the graph when document metadata changes", async () => {
    const root = document("index", "doc-root", "Home");
    const oldChild = document("guides/cache", "doc-cache", "Old title");
    const newChild = document("guides/cache", "doc-cache", "New title");
    let documents = [root, oldChild];
    const provider: DocumentProvider = { getAll: async () => documents };
    const eventBus = new InMemoryEventBus();
    const module = await NavigationModule.create(provider, eventBus);

    documents = [root, newChild];
    const result = await eventBus.publish(new DocumentUpdated("doc-cache"));

    expect(result.isSuccess).toBe(true);
    expect(
      module.navigationService.getBreadcrumbs(
        DocumentPath.create("guides/cache").getValue()
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "guides/cache", title: "New title" }),
      ])
    );
  });
});
