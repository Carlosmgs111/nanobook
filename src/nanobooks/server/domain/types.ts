export type NanobookVisibility = "public" | "private";

/** Settings owned by a nanobook; provider credentials are intentionally excluded. */
export type NanobookSettings = Record<string, unknown>;

export interface CreateNanobookData {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  visibility?: NanobookVisibility;
  settings?: NanobookSettings;
  contentVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PersistedNanobook {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  visibility: NanobookVisibility;
  settings: NanobookSettings;
  contentVersion: number;
  createdAt: Date;
  updatedAt: Date;
}
