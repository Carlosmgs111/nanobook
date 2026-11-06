import type { Element, Root } from "hast";
import type { MarkdownExtension } from "../../../rendering/shared/MarkdownExtension";
import type { FinancialFenceKind } from "../model/FinancialBlock";
import { isFinancialFenceKind, parseFinancialBlock } from "../parsing/parseFinancialBlock";
import { renderFinancialBlock } from "./renderFinancialBlock";
import { renderFinancialError, renderUnavailableFinancialBlock } from "./renderFinancialError";

function financialFence(node: Element): { kind: FinancialFenceKind; yaml: string } | undefined {
  if (node.tagName !== "pre" || node.children.length !== 1) return;
  const [code] = node.children;
  if (code.type !== "element" || code.tagName !== "code") return;

  const classes = code.properties.className;
  const className = Array.isArray(classes) && classes.length === 1 ? classes[0] : classes;
  if (typeof className !== "string" || !className.startsWith("language-")) return;
  const kind = className.slice("language-".length);
  if (!isFinancialFenceKind(kind)) return;

  const yaml = code.children.filter((child) => child.type === "text").map((child) => child.value).join("");
  return { kind, yaml };
}

function renderFence(kind: FinancialFenceKind, yaml: string, blockIndex: number): Element {
  try {
    const parsed = parseFinancialBlock(kind, yaml);
    if (!parsed.isSuccess) return renderFinancialError({ kind, blockIndex, error: parsed.getError() });
    return renderFinancialBlock(parsed.getValue(), { blockIndex });
  } catch {
    return renderUnavailableFinancialBlock(kind, blockIndex);
  }
}

export function createFinancialContentExtension(): MarkdownExtension {
  return {
    id: "financial-content",
    version: "1",
    fenceLanguages: [
      "company-profile",
      "financial-chart",
      "financial-metrics",
      "financial-news",
      "financial-sources",
    ],
    transform(tree) {
      let blockIndex = 0;

      function visit(parent: Root | Element): void {
        parent.children.forEach((node, index) => {
          if (node.type !== "element") return;
          const fence = financialFence(node);
          if (fence) {
            parent.children[index] = renderFence(fence.kind, fence.yaml, blockIndex++);
          } else {
            visit(node);
          }
        });
      }

      visit(tree);
    },
  };
}
