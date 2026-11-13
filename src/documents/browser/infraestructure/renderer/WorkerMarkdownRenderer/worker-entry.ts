import { counterDemoBlock } from "../../../../../application/browser/components/CounterDemo/counterDemoBlock";
import { FinancialContentModule } from "../../../../../financial-content/browser";
import {
  createBlockRegistry,
  createComponentBlocksExtension,
  createMarkdownEngine,
} from "../../../../../rendering/shared";
import { UnifiedMarkdownRenderer } from "../UnifiedMarkdownRenderer";
import type { RenderRequest, RenderResponse } from "./protocol";

// Raíz de composición del Worker: los mismos módulos que el servidor, para producir el mismo HTML.
const blocks = createBlockRegistry();
FinancialContentModule.create(blocks);
blocks.register([counterDemoBlock]);

const renderer = new UnifiedMarkdownRenderer(createMarkdownEngine([createComponentBlocksExtension(blocks)]));

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
