import { describe, expect, it } from "vitest";
import { SessionStorageDocumentStorage } from "./SessionStorageDocumentStorage";
import { buildSerializedEntry, FakeStorage } from "../../application/test/factories";

describe("SessionStorageDocumentStorage", () => {
  it("aísla borrador, preview y confirmado por identidad estable del documento", () => {
    const storage = new SessionStorageDocumentStorage(new FakeStorage());
    const first = buildSerializedEntry({ documentId: "doc-1", path: "a" });
    const second = buildSerializedEntry({ documentId: "doc-2", path: "b" });

    storage.saveStagedDocument("doc-1", first);
    storage.saveStagedDocument("doc-2", second);
    storage.saveCachedPreview("doc-1", { rendered: { Content: "<p/>" }, source: first });
    storage.saveConfirmedDocument("doc-1", first);

    expect(storage.loadStagedDocument("doc-1").getValue()).toEqual(first);
    expect(storage.loadStagedDocument("doc-2").getValue()).toEqual(second);
    expect(storage.loadCachedPreview("doc-1").getValue()?.rendered.Content).toBe("<p/>");
    expect(storage.loadConfirmedDocument("doc-2").getValue()).toBeNull();
    expect(storage.loadStagedDocument("a").getValue()).toBeNull();
  });

  it("clearAll borra todo el estado de un documento y respeta el resto", () => {
    const fake = new FakeStorage();
    const storage = new SessionStorageDocumentStorage(fake);
    const entry = buildSerializedEntry();
    storage.saveStagedDocument("d", entry);
    storage.saveCachedPreview("d", { rendered: { Content: "x" }, source: entry });
    storage.saveConfirmedDocument("d", entry);
    storage.saveStagedDocument("other", entry);

    expect(storage.clearAll("d").isSuccess).toBe(true);

    expect(fake.length).toBe(1);
    expect(storage.loadStagedDocument("other").getValue()).toEqual(entry);
  });

  it("solo persiste el documento serializado y el preview, sin credenciales", () => {
    const fake = new FakeStorage();
    const storage = new SessionStorageDocumentStorage(fake);
    storage.saveStagedDocument("d", buildSerializedEntry());

    const stored = JSON.stringify(fake.getItem(fake.key(0)!));
    expect(stored).not.toMatch(/password|contraseña|hash|salt|token/i);
  });

  it("convierte fallos de sessionStorage en Result.fail", () => {
    const broken = new FakeStorage();
    broken.setItem = () => { throw new Error("quota"); };
    broken.getItem = () => "{no json";
    const storage = new SessionStorageDocumentStorage(broken);

    expect(storage.saveStagedDocument("d", buildSerializedEntry()).isSuccess).toBe(false);
    expect(storage.loadStagedDocument("d").isSuccess).toBe(false);
  });
});
