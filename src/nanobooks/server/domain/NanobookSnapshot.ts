import { Nanobook } from "./Nanobook";
import type {
  NanobookSettings,
  NanobookSetupStatus,
  NanobookVisibility,
} from "./types";

export interface NanobookSnapshot {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  visibility: NanobookVisibility;
  settings: NanobookSettings;
  setupStatus: NanobookSetupStatus;
  createdAt: string;
  updatedAt: string;
}

export function toNanobookSnapshot(nanobook: Nanobook): NanobookSnapshot {
  const persisted = nanobook.toPersistence();
  return {
    ...persisted,
    createdAt: persisted.createdAt.toISOString(),
    updatedAt: persisted.updatedAt.toISOString(),
  };
}

export function fromNanobookSnapshot(value: unknown): Nanobook | null {
  if (!isNanobookSnapshot(value)) return null;

  const createdAt = parseDate(value.createdAt);
  const updatedAt = parseDate(value.updatedAt);
  if (!createdAt || !updatedAt) return null;

  const result = Nanobook.create({
    ...value,
    createdAt,
    updatedAt,
  });
  return result.isSuccess ? result.getValue() : null;
}

function isNanobookSnapshot(value: unknown): value is NanobookSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  return (
    typeof snapshot.id === "string" &&
    typeof snapshot.ownerId === "string" &&
    typeof snapshot.slug === "string" &&
    typeof snapshot.name === "string" &&
    (snapshot.visibility === "public" || snapshot.visibility === "private") &&
    typeof snapshot.settings === "object" &&
    snapshot.settings !== null &&
    !Array.isArray(snapshot.settings) &&
    (snapshot.setupStatus === "pending" ||
      snapshot.setupStatus === "ready" ||
      snapshot.setupStatus === "failed") &&
    typeof snapshot.createdAt === "string" &&
    typeof snapshot.updatedAt === "string"
  );
}

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
