import { and, asc, eq, isNull } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { contentOutbox } from "./DrizzleDocumentRevisionSchema";

export interface ContentOutboxEvent {
  id: string;
  nanobookId: string;
  contentVersion: number;
  eventType: string;
  payload: unknown;
}

export type ContentOutboxHandler = (event: ContentOutboxEvent) => Promise<void>;

export class DrizzleContentOutboxDispatcher {
  constructor(
    private readonly database: LibSQLDatabase<any>,
    private readonly handler: ContentOutboxHandler,
  ) {}

  async dispatch(nanobookId: string): Promise<number> {
    const pending = await this.database
      .select()
      .from(contentOutbox)
      .where(and(eq(contentOutbox.nanobookId, nanobookId), isNull(contentOutbox.deliveredAt)))
      .orderBy(asc(contentOutbox.createdAt));
    let delivered = 0;
    for (const row of pending) {
      const event: ContentOutboxEvent = {
        id: row.id,
        nanobookId: row.nanobookId,
        contentVersion: row.contentVersion,
        eventType: row.eventType,
        payload: JSON.parse(row.payloadJson),
      };
      await this.handler(event);
      await this.database
        .update(contentOutbox)
        .set({ deliveredAt: new Date() })
        .where(eq(contentOutbox.id, row.id));
      delivered += 1;
    }
    return delivered;
  }
}
