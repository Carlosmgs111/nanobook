import type { Document } from "../../document/model/types";

const STAGED_KEY = "stagedDocument";

export function loadStagedDocument(): Document | null {
  const raw = sessionStorage.getItem(STAGED_KEY);
  return raw ? (JSON.parse(raw) as Document) : null;
}

export function saveStagedDocument(document: Document): void {
  sessionStorage.setItem(STAGED_KEY, JSON.stringify(document));
}

export function ensureStagedDocument(base: Document): Document {
  const existing = loadStagedDocument();
  if (existing) return existing;
  saveStagedDocument(base);
  return base;
}

export function clearStagedDocument(): void {
  sessionStorage.removeItem(STAGED_KEY);
}
