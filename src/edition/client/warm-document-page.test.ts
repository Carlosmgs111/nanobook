import { describe, expect, it, vi } from "vitest";
import { warmDocumentPage } from "./warm-document-page";

describe("warmDocumentPage", () => {
  it("requests the saved page without delaying the caller", () => {
    const fetchPage = vi.fn(() => new Promise<Response>(() => {}));

    warmDocumentPage("/guides/cache", fetchPage);

    expect(fetchPage).toHaveBeenCalledWith("/guides/cache", {
      credentials: "same-origin",
    });
  });

  it("absorbs a warming failure", async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(warmDocumentPage("/guides/cache", fetchPage)).resolves.toBeUndefined();
  });
});
