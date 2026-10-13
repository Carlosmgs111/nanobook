import type { Entry, DocumentMetadata } from "../../domain/types";

export interface SerializedEntry extends Omit<Entry, "metadata"> {
  metadata: Omit<DocumentMetadata, "createdAt" | "updatedAt"> & {
    createdAt: string;
    updatedAt: string;
  };
}

export interface SerializedDocumentMetadata
  extends Omit<DocumentMetadata, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}

export function serializeEntry(entry: Entry): SerializedEntry {
  return {
    ...entry,
    metadata: {
      ...entry.metadata,
      createdAt: entry.metadata.createdAt.toISOString(),
      updatedAt: entry.metadata.updatedAt.toISOString(),
    },
  };
}

export function deserializeEntry(serialized: SerializedEntry): Entry {
  return {
    ...serialized,
    metadata: {
      ...serialized.metadata,
      createdAt: new Date(serialized.metadata.createdAt),
      updatedAt: new Date(serialized.metadata.updatedAt),
    },
  };
}
