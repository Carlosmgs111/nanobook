import { describe, expect, it, vi } from "vitest";
import { RenderPreview } from "../RenderPreview";
import { Result } from "../../../shared/domain/Result";
import { buildRenderedPreview, buildSerializedEntry } from "./factories";

describe("RenderPreview", () => {
  it("shares an in-progress render with concurrent callers", async () => {
    const document = buildSerializedEntry();
    let completeRender!: (result: ReturnType<typeof Result.ok>) => void;
    const renderPromise = new Promise<ReturnType<typeof Result.ok>>((resolve) => {
      completeRender = resolve;
    });
    const storage = {
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(document)),
      loadCachedPreview: vi.fn().mockReturnValue(Result.ok(null)),
      saveCachedPreview: vi.fn().mockReturnValue(Result.ok()),
    };
    const renderer = { render: vi.fn().mockReturnValue(renderPromise) };
    const eventBus = {
      publish: vi.fn().mockResolvedValue(Result.ok()),
      subscribe: vi.fn(),
    };
    const useCase = new RenderPreview(storage as never, renderer as never, eventBus as never);

    const first = useCase.execute(document.id);
    const second = useCase.execute(document.id);
    const rendered = buildRenderedPreview();
    completeRender(Result.ok(rendered));

    await expect(first).resolves.toEqual(Result.ok(rendered));
    await expect(second).resolves.toEqual(Result.ok(rendered));
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });
});
