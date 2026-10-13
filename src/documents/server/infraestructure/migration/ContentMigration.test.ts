import { describe, expect, it } from "vitest";
import {
  assignDocuments,
  buildMigrationReport,
  ContentMigrationValidationError,
  type MigrationManifest,
} from "./ContentMigration";

const manifest: MigrationManifest = {
  source: { type: "filesystem", root: "src/content" },
  destinations: [
    { nanobookId: "general", sourceRoot: "index", slug: "general", ownerId: "owner-1", visibility: "private" },
    { nanobookId: "architecture", sourceRoot: "engineering/architecture/index", slug: "architecture", ownerId: "owner-1", visibility: "public" },
  ],
  boundaries: [
    { sourceIndex: "index", decision: "independent", destination: "general" },
    { sourceIndex: "engineering/index", decision: "directory", destination: "general" },
    { sourceIndex: "engineering/architecture/index", decision: "independent", destination: "architecture" },
  ],
};

describe("ContentMigration", () => {
  it("assigns every document to the closest independent root", () => {
    const result = assignDocuments(manifest, [
      { id: "root", path: "index", nanobook: true },
      { id: "guide", path: "engineering/index" },
      { id: "architecture", path: "engineering/architecture/index", nanobook: true },
      { id: "ddd", path: "engineering/architecture/ddd" },
    ]);

    expect(result).toEqual([
      expect.objectContaining({ id: "root", destination: "general", targetPath: "index" }),
      expect.objectContaining({ id: "guide", destination: "general", targetPath: "engineering/index" }),
      expect.objectContaining({ id: "architecture", destination: "architecture", targetPath: "index" }),
      expect.objectContaining({ id: "ddd", destination: "architecture", targetPath: "ddd" }),
    ]);
    expect(buildMigrationReport(manifest, [
      { id: "root", path: "index", nanobook: true },
      { id: "guide", path: "engineering/index" },
      { id: "architecture", path: "engineering/architecture/index", nanobook: true },
      { id: "ddd", path: "engineering/architecture/ddd" },
    ]).destinations).toEqual([
      { nanobookId: "general", slug: "general", documents: 2 },
      { nanobookId: "architecture", slug: "architecture", documents: 2 },
    ]);
  });

  it("blocks marked boundaries without an explicit decision", () => {
    expect(() => assignDocuments(manifest, [
      { id: "unknown", path: "engineering/unknown/index", nanobook: true },
    ])).toThrow(ContentMigrationValidationError);
  });

  it("blocks duplicate roots and orphan documents", () => {
    expect(() => assignDocuments({
      ...manifest,
      destinations: [...manifest.destinations, { ...manifest.destinations[0], nanobookId: "duplicate" }],
    }, [])).toThrow("Raíz de origen duplicada");
    expect(() => assignDocuments({
      ...manifest,
      destinations: [manifest.destinations[1]],
      boundaries: [manifest.boundaries[2]],
    }, [{ id: "orphan", path: "outside" }]))
      .toThrow("Documento huérfano");
  });
});
