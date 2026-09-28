import { describe, expect, it, vi } from "vitest";
import { DeleteDocument } from "./DeleteDocument";
import { DocumentDeleted } from "../domain/events/DocumentDeleted";
import {
  DocumentDeletionPartialError,
  DocumentNotFoundError,
  DocumentRepositoryError,
} from "../domain/errors";
import { Result } from "../../shared/domain/Result";
import { createDocument, createEventBus, createRepository } from "./test/factories";

describe("DeleteDocument", () => {
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

    const result = await new DeleteDocument(repository, eventBus).execute(
      directory.getDocumentId().getValue()
    );

    expect(result.isSuccess).toBe(true);
    expect(repository.delete).toHaveBeenCalledTimes(2);
    expect(repository.delete).toHaveBeenNthCalledWith(1, directory);
    expect(repository.delete).toHaveBeenNthCalledWith(2, child);
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

    const result = await new DeleteDocument(repository, eventBus).execute(
      file.getDocumentId().getValue()
    );

    expect(result.isSuccess).toBe(true);
    expect(repository.delete).toHaveBeenCalledTimes(1);
    expect(repository.delete).toHaveBeenCalledWith(file);
  });

  it("returns not found without deleting when the path does not exist", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();

    const result = await new DeleteDocument(repository, eventBus).execute("missing");

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

    const result = await new DeleteDocument(repository, eventBus).execute(
      document.getDocumentId().getValue()
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

    const result = await new DeleteDocument(repository, eventBus).execute(
      directory.getDocumentId().getValue()
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
