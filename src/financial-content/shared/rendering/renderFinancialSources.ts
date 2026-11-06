import type { Element } from "hast";
import type { FinancialSourcesBlock } from "../model/FinancialBlock";
import type { FinancialSource, FinancialSourceType } from "../model/FinancialSource";
import { element, externalLink, financialId, text } from "./hast";
import type { FinancialRenderContext } from "./renderFinancialBlock";
import { renderSourceTemporalMetadata } from "./renderFinancialTemporalMetadata";

const sourceTypeLabels: Record<FinancialSourceType, string> = {
  filing: "Reporte regulatorio",
  earnings: "Resultados",
  news: "Noticia",
  dataset: "Conjunto de datos",
  other: "Otra fuente",
};

function renderSource(source: FinancialSource): Element {
  const metadata = [source.organization, sourceTypeLabels[source.type]].filter(Boolean).join(" · ");
  return element("li", [
    externalLink(source.label, source.url),
    element("p", [text(metadata)], { className: ["financial-sources__meta"] }),
    ...renderSourceTemporalMetadata(source).map((field) => element("p", field)),
  ]);
}

export function renderFinancialSources(block: FinancialSourcesBlock, context: FinancialRenderContext): Element {
  const headingId = financialId("sources", context.blockIndex, "heading");
  const children = [element("h2", [text(block.title ?? "Fuentes")], { id: headingId })];
  if (block.description) children.push(element("p", [text(block.description)]));
  children.push(element("ol", block.items.map(renderSource), { className: ["financial-sources__list"] }));

  return element("section", children, {
    className: ["financial-block", "financial-sources"],
    ariaLabelledBy: headingId,
  });
}
