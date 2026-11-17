import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { RenderPreview } from "./RenderPreview";
import { GetRenderedDocument } from "./GetRenderedDocument";
import { SessionStorageDocumentStorage } from "../infraestructure/storage/SessionStorageDocumentStorage";
import { DocumentChanged } from "../domain/events/DocumentChanged";
import { buildSerializedEntry, FakeStorage } from "./test/factories";

function setup(render = vi.fn().mockResolvedValue(Result.ok({ Content: "<h1>Intro</h1>" }))) {
  const staged = buildSerializedEntry();
  const storage = new SessionStorageDocumentStorage(new FakeStorage());
  storage.saveStagedDocument(staged.documentId, staged);
  const eventBus = { publish: vi.fn(), subscribe: vi.fn() };
  const useCase = new RenderPreview(storage, { render }, eventBus as never);
  return { storage, staged, render, eventBus, useCase };
}

describe("RenderPreview", () => {
  it("renderiza el borrador, lo cachea y publica DocumentChanged", async () => {
    const { storage, staged, render, eventBus, useCase } = setup();

    const result = await useCase.execute(staged.documentId);

    expect(result.getValue()).toEqual({ Content: "<h1>Intro</h1>" });
    expect(render).toHaveBeenCalledWith(staged.content);
    expect(eventBus.publish).toHaveBeenCalledWith(expect.any(DocumentChanged));
    const cached = new GetRenderedDocument(storage).execute(staged.documentId);
    expect(cached.getValue().rendered).toEqual({ Content: "<h1>Intro</h1>" });
  });

  it("reutiliza el preview cacheado si el borrador no cambió", async () => {
    const { staged, render, useCase } = setup();

    await useCase.execute(staged.documentId);
    await useCase.execute(staged.documentId);

    expect(render).toHaveBeenCalledTimes(1);
  });

  it("devuelve null sin borrador y propaga errores del renderizador", async () => {
    const empty = setup();
    expect((await empty.useCase.execute("missing")).getValue()).toBeNull();

    const failing = setup(vi.fn().mockResolvedValue(Result.fail(new Error("boom"))));
    const result = await failing.useCase.execute(failing.staged.documentId);
    expect(result.isSuccess).toBe(false);
  });

  it("comparte el render en curso entre llamadas concurrentes", async () => {
    let finish!: (value: unknown) => void;
    const pending = new Promise((resolve) => { finish = resolve; });
    const { staged, render, useCase } = setup(vi.fn().mockReturnValue(pending));

    const first = useCase.execute(staged.documentId);
    const second = useCase.execute(staged.documentId);
    finish(Result.ok({ Content: "<p>x</p>" }));

    expect((await first).getValue()).toEqual({ Content: "<p>x</p>" });
    expect((await second).getValue()).toEqual({ Content: "<p>x</p>" });
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("descarta el resultado si el borrador cambió mientras se renderizaba", async () => {
    let finish!: (value: unknown) => void;
    const pending = new Promise((resolve) => { finish = resolve; });
    const { storage, staged, eventBus, useCase } = setup(vi.fn().mockReturnValue(pending));

    const running = useCase.execute(staged.documentId);
    storage.saveStagedDocument(staged.documentId, { ...staged, content: "nuevo", version: "v2" });
    finish(Result.ok({ Content: "<p>viejo</p>" }));

    expect((await running).getValue()).toBeNull();
    expect(storage.loadCachedPreview(staged.documentId).getValue()).toBeNull();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});

describe("GetRenderedDocument", () => {
  it("con confirmación exige que el preview corresponda al documento guardado", async () => {
    const { storage, staged, useCase } = setup();
    await useCase.execute(staged.documentId);
    const getRendered = new GetRenderedDocument(storage);

    expect(getRendered.execute(staged.documentId, true).isSuccess).toBe(false);

    storage.saveConfirmedDocument(staged.documentId, staged);
    expect(getRendered.execute(staged.documentId, true).isSuccess).toBe(true);
  });
});
