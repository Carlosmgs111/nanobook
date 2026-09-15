import { worker } from "../../publishing/client/workers";
import type { SerializedEntry } from "../../document/application/dto/SerializedEntry";
import type { RenderedDocument } from "../../publishing/domain/render";

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

function sameDocument(a: SerializedEntry, b: SerializedEntry): boolean {
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

export function getStagedDocument(): SerializedEntry | null {
  return read<SerializedEntry>(STAGED_KEY);
}

export function getRenderedDocument(): RenderedDocument | null {
  return read<RenderedDocument>(RENDERED_KEY);
}

export function getRenderedDocumentSource(): SerializedEntry | null {
  return read<SerializedEntry>(RENDERED_SOURCE_KEY);
}

export function clearRenderedDocument(): void {
  remove(RENDERED_KEY);
  remove(RENDERED_SOURCE_KEY);
}

export async function renderStagedDocument(
  stagedDocument: SerializedEntry
): Promise<RenderedDocument | null> {
  const pending = read<SerializedEntry>(PENDING_KEY);
  if (pending && sameDocument(pending, stagedDocument)) {
    return waitForRender();
  }

  const existingSource = read<SerializedEntry>(RENDERED_SOURCE_KEY);
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
