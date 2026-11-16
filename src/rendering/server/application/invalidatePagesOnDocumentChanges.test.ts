import { describe, expect, it, vi } from "vitest";
import { DomainEvent } from "../../../shared/domain/DomainEvent";
import { Result } from "../../../shared/domain/Result";
import { InMemoryEventBus } from "../../../shared/infrastructure/InMemoryEventBus";
import { invalidatePagesOnDocumentChanges } from "./invalidatePagesOnDocumentChanges";

class DocumentEvent extends DomainEvent {
  constructor(readonly name: string, readonly documentId: string) {
    super(crypto.randomUUID());
  }
}

function setup() {
  const eventBus = new InMemoryEventBus();
  const invalidate = vi.fn(async () => Result.ok());
  const unsubscribe = invalidatePagesOnDocumentChanges(eventBus, { invalidate });
  return { eventBus, invalidate, unsubscribe };
}

describe("invalidatePagesOnDocumentChanges", () => {
  it.each(["document.created", "document.updated", "document.deleted"])(
    "invalidates the page on %s",
    async (name) => {
      const { eventBus, invalidate } = setup();

      const result = await eventBus.publish(new DocumentEvent(name, "doc-1"));

      expect(result.isSuccess).toBe(true);
      expect(invalidate).toHaveBeenCalledWith(["doc-1"]);
    },
  );

  it("ignores other events and stops once unsubscribed", async () => {
    const { eventBus, invalidate, unsubscribe } = setup();

    await eventBus.publish(new DocumentEvent("document.renamed", "doc-1"));
    unsubscribe();
    await eventBus.publish(new DocumentEvent("document.updated", "doc-1"));

    expect(invalidate).not.toHaveBeenCalled();
  });
});
