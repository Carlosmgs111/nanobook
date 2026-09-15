import type { Entry, DocumentMetadata } from "../../domain/types";

export interface SerializedEntry extends Omit<Entry, "metadata"> {
  metadata: Omit<DocumentMetadata, "date"> & { date: string };
}

export interface SerializedDocumentMetadata
  extends Omit<DocumentMetadata, "date"> {
  date: string;
}

export function serializeEntry(entry: Entry): SerializedEntry {
  return {
    ...entry,
    metadata: {
      ...entry.metadata,
      date: entry.metadata.date.toISOString(),
    },
  };
}

export function deserializeEntry(serialized: SerializedEntry): Entry {
  return {
    ...serialized,
    metadata: {
      ...serialized.metadata,
      date: new Date(serialized.metadata.date),
    },
  };
}
