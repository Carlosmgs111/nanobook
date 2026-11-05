import type { Element } from "hast";
import type { FinancialBlock } from "../model/FinancialBlock";
import { renderCompanyProfile } from "./renderCompanyProfile";
import { renderUnavailableFinancialBlock } from "./renderFinancialError";
import { renderFinancialMetrics } from "./renderFinancialMetrics";
import { renderFinancialSources } from "./renderFinancialSources";

export interface FinancialRenderContext {
  blockIndex: number;
}

export function renderFinancialBlock(block: FinancialBlock, context: FinancialRenderContext): Element {
  switch (block.kind) {
    case "company-profile":
      return renderCompanyProfile(block, context);
    case "financial-metrics":
      return renderFinancialMetrics(block, context);
    case "financial-sources":
      return renderFinancialSources(block, context);
    case "financial-chart":
    case "financial-news":
      return renderUnavailableFinancialBlock(block.kind, context.blockIndex);
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}
