import type { Element } from "hast";
import type { FinancialBlock } from "../model/FinancialBlock";
import { renderCompanyProfile } from "./renderCompanyProfile";
import { renderUnavailableFinancialBlock } from "./renderFinancialError";

export interface FinancialRenderContext {
  blockIndex: number;
}

export function renderFinancialBlock(block: FinancialBlock, context: FinancialRenderContext): Element {
  switch (block.kind) {
    case "company-profile":
      return renderCompanyProfile(block, context);
    case "financial-chart":
    case "financial-metrics":
    case "financial-news":
    case "financial-sources":
      return renderUnavailableFinancialBlock(block.kind, context.blockIndex);
  }
}
