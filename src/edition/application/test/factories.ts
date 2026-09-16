import { vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import type { DocumentStorage } from "../../domain/ports/DocumentStorage";
import type { PreviewRenderer } from "../../domain/ports/PreviewRenderer";
import type { PageWarmingService } from "../../domain/ports/PageWarmingService";
import type { SerializedEntry, RenderedPreview } from "../../domain/model/StagedDocument";

export function createDocumentStorage(
  overrides: Partial<DocumentStorage> = {}
): DocumentStorage {
  return {
    loadStagedDocument: vi.fn().mockReturnValue(Result.ok(null)),
    saveStagedDocument: vi.fn().mockReturnValue(Result.ok()),
    clearStagedDocument: vi.fn().mockReturnValue(Result.ok()),
    loadRenderedDocument: vi.fn().mockReturnValue(Result.ok(null)),
    saveRenderedDocument: vi.fn().mockReturnValue(Result.ok()),
    clearRenderedDocument: vi.fn().mockReturnValue(Result.ok()),
    loadRenderedSource: vi.fn().mockReturnValue(Result.ok(null)),
    saveRenderedSource: vi.fn().mockReturnValue(Result.ok()),
    loadPendingDocument: vi.fn().mockReturnValue(Result.ok(null)),
    savePendingDocument: vi.fn().mockReturnValue(Result.ok()),
    clearPendingDocument: vi.fn().mockReturnValue(Result.ok()),
    loadSavedAt: vi.fn().mockReturnValue(Result.ok(null)),
    markSavedAt: vi.fn().mockReturnValue(Result.ok()),
    clearSavedAt: vi.fn().mockReturnValue(Result.ok()),
    clearAll: vi.fn().mockReturnValue(Result.ok()),
    ...overrides,
  };
}

export function createPreviewRenderer(
  overrides: Partial<PreviewRenderer> = {}
): PreviewRenderer {
  return {
    render: vi.fn().mockResolvedValue(Result.ok({ Content: "<h1>Preview</h1>" })),
    ...overrides,
  };
}

export function createPageWarmingService(
  overrides: Partial<PageWarmingService> = {}
): PageWarmingService {
  return {
    warm: vi.fn().mockResolvedValue(Result.ok()),
    ...overrides,
  };
}

export function buildSerializedEntry(
  overrides: Partial<SerializedEntry> & { id?: string } = {}
): SerializedEntry {
  const id = overrides.id ?? "intro";
  return {
    id,
    title: "Introduction",
    description: "Getting started",
    content: "# Intro\n\nHello.",
    rawFrontmatter: '---\ntitle: "Introduction"\ndescription: "Getting started"\n---\n',
    slug: id,
    parentId: id === "index" ? undefined : "index",
    position: 0,
    headings: [],
    metadata: {
      title: "Introduction",
      description: "Getting started",
      date: "2024-01-01T00:00:00.000Z",
      index: id === "index" || id.endsWith("/index"),
    },
    ...overrides,
  };
}

export function buildRenderedPreview(
  overrides: Partial<RenderedPreview> = {}
): RenderedPreview {
  return {
    Content: "<h1>Preview</h1>",
    ...overrides,
  };
}
