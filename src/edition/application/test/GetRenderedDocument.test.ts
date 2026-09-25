import { describe, expect, it, vi } from "vitest";
import { GetRenderedDocument } from "../GetRenderedDocument";
import { Result } from "../../../shared/domain/Result";
import { buildCachedPreview, buildSerializedEntry } from "./factories";

describe("GetRenderedDocument", () => {
  it("does not expose a preview that has not been confirmed as saved", () => {
    const source = buildSerializedEntry();
    const storage = {
      loadCachedPreview: vi.fn().mockReturnValue(Result.ok(buildCachedPreview({ source }))),
      loadConfirmedDocument: vi.fn().mockReturnValue(Result.ok(null)),
    };
    const useCase = new GetRenderedDocument(storage as never);

    const result = useCase.execute(source.id, true);

    expect(result.isSuccess).toBe(false);
  });

  it("exposes the preview that matches the confirmed document", () => {
    const source = buildSerializedEntry();
    const cached = buildCachedPreview({ source });
    const storage = {
      loadCachedPreview: vi.fn().mockReturnValue(Result.ok(cached)),
      loadConfirmedDocument: vi.fn().mockReturnValue(Result.ok(source)),
    };
    const useCase = new GetRenderedDocument(storage as never);

    const result = useCase.execute(source.id);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual(cached);
  });

  it("exposes an unconfirmed preview when confirmation is not required", () => {
    const source = buildSerializedEntry();
    const cached = buildCachedPreview({ source });
    const storage = {
      loadCachedPreview: vi.fn().mockReturnValue(Result.ok(cached)),
      loadConfirmedDocument: vi.fn().mockReturnValue(Result.ok(null)),
    };
    const useCase = new GetRenderedDocument(storage as never);

    const result = useCase.execute(source.id);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual(cached);
  });
});
