import type { SerializedEntry } from "../../document/application/dto/SerializedEntry";

const STAGED_KEY = "stagedDocument";
const STAGED_SAVED_AT_KEY = "stagedDocumentSavedAt";

export function loadStagedDocument(): SerializedEntry | null {
  const raw = sessionStorage.getItem(STAGED_KEY);
  return raw ? (JSON.parse(raw) as SerializedEntry) : null;
}

export function saveStagedDocument(document: SerializedEntry): void {
  sessionStorage.setItem(STAGED_KEY, JSON.stringify(document));
}

export function ensureStagedDocument(base: SerializedEntry): SerializedEntry {
  const existing = loadStagedDocument();
  if (existing) return existing;
  saveStagedDocument(base);
  return base;
}

export function markStagedDocumentAsSaved(): void {
  sessionStorage.setItem(STAGED_SAVED_AT_KEY, String(Date.now()));
}

export function getStagedDocumentSavedAt(): number | null {
  const raw = sessionStorage.getItem(STAGED_SAVED_AT_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

export function isStagedDocumentSaved(): boolean {
  return getStagedDocumentSavedAt() !== null;
}

export function clearStagedDocumentSavedAt(): void {
  sessionStorage.removeItem(STAGED_SAVED_AT_KEY);
}

export function clearStagedDocument(): void {
  sessionStorage.removeItem(STAGED_KEY);
  sessionStorage.removeItem(STAGED_SAVED_AT_KEY);
}
