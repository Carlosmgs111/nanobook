import { blockDefinitions } from "../../../../../application/shared/blocks";
import {
  createComponentBlocksExtension,
  createMarkdownEngine,
  registerBlocks,
} from "../../../../../rendering/shared";
import { UnifiedMarkdownRenderer } from "../UnifiedMarkdownRenderer";
import type { RenderRequest, RenderResponse } from "./protocol";

const renderer = new UnifiedMarkdownRenderer(
  createMarkdownEngine([createComponentBlocksExtension(registerBlocks(blockDefinitions))]),
);

self.addEventListener(
  "message",
  async (event: MessageEvent<RenderRequest>) => {
    const { id, content } = event.data;
    const result = await renderer.render(content);

    const response: RenderResponse = result.isSuccess
      ? {
          id,
          ok: true,
          html: result.getValue().Content,
        }
      : {
          id,
          ok: false,
          error: result.getError().message,
        };

    self.postMessage(response);
  }
);
