import { Result } from "../../../../shared/domain/Result";
import { EventBusError } from "../../../../shared/domain/bus/errors";
import type { DocumentSourceCache } from "../DocumentSourceCache";
import type { DocumentCreated } from "../../domain/events/DocumentCreated";
import type { DocumentUpdated } from "../../domain/events/DocumentUpdated";
import type { DocumentDeleted } from "../../domain/events/DocumentDeleted";

type DocumentEvent = DocumentCreated | DocumentUpdated | DocumentDeleted;

export class InvalidateDocumentSourceCache {
  constructor(private readonly sourceCache: DocumentSourceCache) {}

  async handle(event: DocumentEvent): Promise<Result<EventBusError, void>> {
    if (!event.nanobookId) return Result.ok();
    try {
      await this.sourceCache.invalidateNanobook(event.nanobookId);
      return Result.ok();
    } catch (cause) {
      return Result.fail(new EventBusError("Failed to invalidate document source cache", { cause }));
    }
  }
}
