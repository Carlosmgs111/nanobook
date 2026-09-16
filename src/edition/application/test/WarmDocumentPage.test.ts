import { describe, it, expect, vi } from "vitest";
import { WarmDocumentPage } from "../WarmDocumentPage";
import { createPageWarmingService } from "./factories";
import { Result } from "../../../shared/domain/Result";
import { EditionStorageError } from "../../domain/errors";

describe("WarmDocumentPage", () => {
  it("warms the requested page", async () => {
    const service = createPageWarmingService();
    const useCase = new WarmDocumentPage(service);

    const result = await useCase.execute("/guides/cache");

    expect(result.isSuccess).toBe(true);
    expect(service.warm).toHaveBeenCalledWith("/guides/cache");
  });

  it("propagates warming errors", async () => {
    const service = createPageWarmingService({
      warm: vi.fn().mockResolvedValue(Result.fail(new EditionStorageError("offline"))),
    });
    const useCase = new WarmDocumentPage(service);

    const result = await useCase.execute("/guides/cache");

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EditionStorageError);
  });
});
