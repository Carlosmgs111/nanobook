import { worker } from "../workers";
import type { Document } from "../../document/core/types";
import type { RenderedDocument } from "./types";

const STAGED_KEY = "stagedDocument";
const RENDERED_KEY = "renderedStagedDocument";
const RENDERED_SOURCE_KEY = "renderedStagedDocumentSource";
const PENDING_KEY = "renderPendingDocument";

const channel = new BroadcastChannel("rendered-document");

function read<T>(key: string): T | null {
  const raw = sessionStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

function write(key: string, value: unknown): void {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function remove(key: string): void {
  sessionStorage.removeItem(key);
}

function sameDocument(a: Document, b: Document): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function waitForRender(timeoutMs = 30000): Promise<RenderedDocument> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Render timeout"));
    }, timeoutMs);

    function listener() {
      const rendered = read<RenderedDocument>(RENDERED_KEY);
      if (rendered) {
        cleanup();
        resolve(rendered);
      }
    }

    function cleanup() {
      clearTimeout(timeout);
      channel.removeEventListener("message", listener);
    }

    channel.addEventListener("message", listener);
    listener();
  });
}

export function getStagedDocument(): Document | null {
  return read<Document>(STAGED_KEY);
}

export function getRenderedDocument(): RenderedDocument | null {
  return read<RenderedDocument>(RENDERED_KEY);
}

export function getRenderedDocumentSource(): Document | null {
  return read<Document>(RENDERED_SOURCE_KEY);
}

export function clearRenderedDocument(): void {
  remove(RENDERED_KEY);
  remove(RENDERED_SOURCE_KEY);
}

export async function renderStagedDocument(
  stagedDocument: Document
): Promise<RenderedDocument | null> {
  const pending = read<Document>(PENDING_KEY);
  if (pending && sameDocument(pending, stagedDocument)) {
    return waitForRender();
  }

  const existingSource = read<Document>(RENDERED_SOURCE_KEY);
  const existingRendered = read<RenderedDocument>(RENDERED_KEY);
  if (
    existingSource &&
    existingRendered &&
    sameDocument(existingSource, stagedDocument)
  ) {
    return existingRendered;
  }

  write(PENDING_KEY, stagedDocument);
  try {
    const rendered = await worker.render(stagedDocument);
    const current = getStagedDocument();
    if (current && !sameDocument(current, stagedDocument)) {
      return existingRendered ?? null;
    }
    write(RENDERED_KEY, rendered);
    write(RENDERED_SOURCE_KEY, stagedDocument);
    channel.postMessage("");
    return rendered;
  } finally {
    remove(PENDING_KEY);
  }
}

export async function ensureRendered(): Promise<RenderedDocument | null> {
  const staged = getStagedDocument();
  if (!staged) return null;
  return renderStagedDocument(staged);
}
