import type { Element } from "hast";
import type { FinancialBlock } from "../model/FinancialBlock";
import { renderCompanyProfile } from "./renderCompanyProfile";
import { renderFinancialChart } from "./renderFinancialChart";
import { renderFinancialMetrics } from "./renderFinancialMetrics";
import { renderFinancialNews } from "./renderFinancialNews";
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
      return renderFinancialChart(block, context);
    case "financial-news":
      return renderFinancialNews(block, context);
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}
