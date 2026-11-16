import type { DomainEvent } from "../../../shared/domain/DomainEvent";
import type { EventBus } from "../../../shared/domain/bus/EventBus";
import { EventBusError } from "../../../shared/domain/bus/errors";
import { Result } from "../../../shared/domain/Result";
import type { PageRenderer } from "./PageRenderer";

/**
 * Nombres de los eventos con los que `documents` anuncia que un documento nació,
 * cambió o desapareció. `rendering` no puede importar esas clases, así que se
 * suscribe por nombre; el evento trae el `documentId`.
 */
const DOCUMENT_CHANGES = ["document.created", "document.updated", "document.deleted"] as const;

/** Cuando un documento cambia o desaparece, su HTML cacheado deja de valer. Devuelve la función que cancela las suscripciones. */
export function invalidatePagesOnDocumentChanges(eventBus: EventBus, pageRenderer: Pick<PageRenderer, "invalidate">): () => void {
  const handler = {
    async handle(event: DomainEvent & { documentId?: string }) {
      if (!event.documentId) return Result.ok();
      const result = await pageRenderer.invalidate([event.documentId]);
      if (result.isSuccess) return Result.ok();
      return Result.fail(new EventBusError(`Failed to handle ${event.name} event`, { cause: result.getError() }));
    },
  };

  const unsubscribes = DOCUMENT_CHANGES.map((eventName) =>
    eventBus.subscribe({ eventName, prototype: undefined as never }, handler),
  );
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}
