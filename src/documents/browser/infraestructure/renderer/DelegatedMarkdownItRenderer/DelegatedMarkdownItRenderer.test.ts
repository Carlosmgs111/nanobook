import { describe, expect, it } from "vitest";
import { EditionRenderError } from "../../../domain/errors";
import { DelegatedMarkdownItRenderer } from "./index";
import type { RenderRequest, RenderResponse } from "./protocol";

class FailingWorker extends EventTarget {
  postMessage({ id }: RenderRequest): void {
    queueMicrotask(() => {
      this.dispatchEvent(new MessageEvent<RenderResponse>("message", {
        data: { id, ok: false, error: "extension failed" },
      }));
    });
  }
}

describe("DelegatedMarkdownItRenderer", () => {
  it("settles the pending render with EditionRenderError when the Worker reports a failure", async () => {
    const renderer = new DelegatedMarkdownItRenderer(new FailingWorker());

    const result = await renderer.render("Paragraph");

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EditionRenderError);
    expect(result.getError().message).toBe("extension failed");
  });
});
