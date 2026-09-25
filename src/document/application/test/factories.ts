import { vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import type { ContentRepository } from "../../domain/ports/ContentRepository";
import type { EventBus } from "../../../shared/domain/bus/EventBus";
import { Document } from "../../domain/Document";
import type { DocumentInput } from "../dto/DocumentInput";
import type { DocumentMetadata } from "../../domain/types";

export function createRepository(
  overrides: Partial<ContentRepository> = {}
): ContentRepository {
  return {
    list: vi.fn().mockResolvedValue(Result.ok([])),
    getById: vi.fn().mockResolvedValue(Result.ok(null)),
    getByPath: vi.fn().mockResolvedValue(Result.ok(null)),
    listChildren: vi.fn().mockResolvedValue(Result.ok([])),
    create: vi.fn().mockResolvedValue(Result.ok()),
    update: vi.fn().mockResolvedValue(Result.ok()),
    ...overrides,
  };
}

export function createEventBus(): EventBus {
  return {
    publish: vi.fn().mockResolvedValue(Result.ok()),
    subscribe: vi.fn(),
  };
}

export function buildDocumentInput(
  overrides: Partial<DocumentInput> & { id?: string } = {}
): DocumentInput {
  const id = overrides.id ?? "intro";
  return {
    id,
    title: "Introduction",
    description: "Getting started",
    date: new Date("2024-01-01"),
    index: id === "index" || id.endsWith("/index"),
    content: "# Intro\n\nHello.",
    ...overrides,
  };
}

export function createDocument(
  id: string,
  metadata: Partial<DocumentMetadata> & {
    title: string;
    description: string;
  },
  content: string = ""
): Document {
  return Document.create(
    id,
    {
      id: metadata.id ?? crypto.randomUUID(),
      title: metadata.title,
      description: metadata.description,
      date: metadata.date ?? new Date(),
      index: metadata.index ?? (id === "index" || id.endsWith("/index")),
      author: metadata.author,
      tags: metadata.tags,
      cover: metadata.cover,
      draft: metadata.draft,
      position: metadata.position,
      ref: metadata.ref,
    },
    content
  ).getValue();
}
