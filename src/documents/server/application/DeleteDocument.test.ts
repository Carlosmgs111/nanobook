import { describe, expect, it, vi } from "vitest";
import { DeleteDocument } from "./DeleteDocument";
import { DocumentDeleted } from "../domain/events/DocumentDeleted";
import {
  DocumentDeletionPartialError,
  DocumentNotFoundError,
  DocumentRepositoryError,
  DocumentAccessDeniedError,
} from "../domain/errors";
import { Result } from "../../../shared/domain/Result";
import { createDocument, createEventBus, createRepository } from "./test/factories";

describe("DeleteDocument", () => {
  it("denies an authenticated actor who does not own the document", async () => {
    const document = createDocument("private", {
      title: "Private",
      description: "Owned by someone else",
      ownerId: "owner-1",
    });
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(document)),
    });
    const useCase = new DeleteDocument(repository, createEventBus());

    const result = await useCase.execute("book-a",
      document.getDocumentId().getValue(),
      "another-user",
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentAccessDeniedError);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("does not delete an owned directory when it contains another owner's document", async () => {
    const directory = createDocument("guides/index", {
      title: "Guides",
      description: "Guide directory",
      ownerId: "owner-1",
    });
    const child = createDocument("guides/private", {
      title: "Private",
      description: "Another owner's document",
      ownerId: "owner-2",
    });
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(directory)),
      list: vi.fn().mockResolvedValue(Result.ok([directory, child])),
    });

    const result = await new DeleteDocument(repository, createEventBus()).execute("book-a",
      directory.getDocumentId().getValue(),
      "owner-1",
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentAccessDeniedError);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("deletes a directory and all its descendants, then publishes events", async () => {
    const directory = createDocument("guides/index", {
      title: "Guides",
      description: "Guide directory",
    });
    const child = createDocument("guides/intro", {
      title: "Intro",
      description: "Introduction",
    });
    const unrelated = createDocument("about", {
      title: "About",
      description: "About",
    });
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(directory)),
      list: vi.fn().mockResolvedValue(Result.ok([directory, child, unrelated])),
    });
    const eventBus = createEventBus();

    const result = await new DeleteDocument(repository, eventBus).execute("book-a",
      directory.getDocumentId().getValue(),
      "owner-1",
    );

    expect(result.isSuccess).toBe(true);
    expect(repository.delete).toHaveBeenCalledTimes(2);
    expect(repository.delete).toHaveBeenNthCalledWith(1, "book-a", directory);
    expect(repository.delete).toHaveBeenNthCalledWith(2, "book-a", child);
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: DocumentDeleted.eventName,
        documentId: directory.getDocumentId().getValue(),
      })
    );
  });

  it("does not delete descendants when the target is a regular document", async () => {
    const file = createDocument("guides", {
      title: "Guides file",
      description: "A regular document",
    });
    const directory = createDocument("guides/index", {
      title: "Guides directory",
      description: "A directory with the same public name",
    });
    const child = createDocument("guides/intro", {
      title: "Intro",
      description: "Introduction",
    });
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(file)),
      list: vi.fn().mockResolvedValue(Result.ok([file, directory, child])),
    });
    const eventBus = createEventBus();

    const result = await new DeleteDocument(repository, eventBus).execute("book-a",
      file.getDocumentId().getValue(),
      "owner-1",
    );

    expect(result.isSuccess).toBe(true);
    expect(repository.delete).toHaveBeenCalledTimes(1);
    expect(repository.delete).toHaveBeenCalledWith("book-a", file);
  });

  it("returns not found without deleting when the path does not exist", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();

    const result = await new DeleteDocument(repository, eventBus).execute("book-a",
      "missing",
      "owner-1",
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentNotFoundError);
    expect(repository.delete).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("propagates repository deletion failures", async () => {
    const document = createDocument("guides/index", {
      title: "Guides",
      description: "Guide directory",
    });
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(document)),
      list: vi.fn().mockResolvedValue(Result.ok([document])),
      delete: vi.fn().mockResolvedValue(Result.fail(new DocumentRepositoryError("boom"))),
    });
    const eventBus = createEventBus();

    const result = await new DeleteDocument(repository, eventBus).execute("book-a",
      document.getDocumentId().getValue(),
      "owner-1",
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("reports partial deletion and publishes only confirmed deletions", async () => {
    const directory = createDocument("guides/index", {
      title: "Guides",
      description: "Guide directory",
    });
    const child = createDocument("guides/intro", {
      title: "Intro",
      description: "Introduction",
    });
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(directory)),
      list: vi.fn().mockResolvedValue(Result.ok([directory, child])),
      delete: vi
        .fn()
        .mockResolvedValueOnce(Result.ok())
        .mockResolvedValueOnce(Result.fail(new DocumentRepositoryError("boom"))),
    });
    const eventBus = createEventBus();

    const result = await new DeleteDocument(repository, eventBus).execute("book-a",
      directory.getDocumentId().getValue(),
      "owner-1",
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentDeletionPartialError);
    expect((result.getError() as DocumentDeletionPartialError).deletedDocumentIds).toEqual([
      directory.getDocumentId().getValue(),
    ]);
    expect((result.getError() as DocumentDeletionPartialError).failedDocumentId).toBe(
      child.getDocumentId().getValue()
    );
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: directory.getDocumentId().getValue() })
    );
  });
});
