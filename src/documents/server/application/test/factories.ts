import { vi } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import type { ContentRepository } from "../../domain/ports/ContentRepository";
import type { EventBus } from "../../../../shared/domain/bus/EventBus";
import { Document } from "../../domain/Document";
import type { DocumentInput } from "../dto/DocumentInput";
import type { DocumentMetadata } from "../../domain/types";
import { AccessCheckFailedError, createAuthorizer, type Authorizer, type Policy } from "../../../../authorization/server";

export function createRepository(
  overrides: Partial<ContentRepository> = {}
): ContentRepository {
  return {
    list: vi.fn().mockResolvedValue(Result.ok([])),
    getById: vi.fn().mockResolvedValue(Result.ok(null)),
    getByPath: vi.fn().mockResolvedValue(Result.ok(null)),
    getByPublicPath: vi.fn().mockResolvedValue(Result.ok(null)),
    create: vi.fn().mockResolvedValue(Result.ok()),
    updateMany: vi.fn().mockResolvedValue(Result.ok()),
    deleteMany: vi.fn().mockResolvedValue(Result.ok()),
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
  const id = overrides.id ?? crypto.randomUUID();
  return {
    id,
    path: overrides.path ?? "intro",
    title: "Introduction",
    description: "Getting started",
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
      createdAt: metadata.createdAt ?? new Date(),
      updatedAt: metadata.updatedAt ?? metadata.createdAt ?? new Date(),
      ownerId: metadata.ownerId ?? "owner-1",
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

const documentPolicy = (effect: "allow" | "deny"): Policy => ({
  appliesTo: ["document", "nanobook"],
  evaluate: async () => (effect === "allow" ? { effect: "allow" } : { effect: "deny", reason: "forbidden" }),
});

/** Autorizador real que concede todo acceso. */
export const allowAllAuthorizer = (): Authorizer => createAuthorizer([documentPolicy("allow")]);

/** Autorizador real que deniega todo acceso con `deny(forbidden)`. */
export const denyAllAuthorizer = (): Authorizer => createAuthorizer([documentPolicy("deny")]);

/** Autorizador cuyo `require` falla por un error técnico. */
export const failingAuthorizer = (): Authorizer => ({
  authorize: async () => {
    throw new AccessCheckFailedError(new Error("db caída"));
  },
  require: async () => Result.fail(new AccessCheckFailedError(new Error("db caída"))),
});
