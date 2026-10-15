export type NanobookVisibility = "public" | "private";
export type NanobookSetupStatus = "pending" | "ready" | "failed";

/**
 * Settings owned by a nanobook.
 *
 * No nanobook-scoped settings are enabled yet. Keeping the contract closed
 * prevents storage providers, credentials and arbitrary JSON from becoming a
 * hidden configuration API. New settings must be added here with validation
 * in the domain before they are exposed through HTTP or migration manifests.
 */
export type NanobookSettings = Record<string, never>;

export interface CreateNanobookData {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  visibility?: NanobookVisibility;
  settings?: NanobookSettings;
  contentVersion?: number;
  setupStatus?: NanobookSetupStatus;
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
  setupStatus?: NanobookSetupStatus;
  createdAt: Date;
  updatedAt: Date;
}
