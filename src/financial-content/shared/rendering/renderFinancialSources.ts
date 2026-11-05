import type { Element } from "hast";
import { formatFinancialDate } from "../formatting/formatFinancialDate";
import type { FinancialSourcesBlock } from "../model/FinancialBlock";
import type { FinancialSource, FinancialSourceType } from "../model/FinancialSource";
import { element, externalLink, financialId, text } from "./hast";
import type { FinancialRenderContext } from "./renderFinancialBlock";

const sourceTypeLabels: Record<FinancialSourceType, string> = {
  filing: "Reporte regulatorio",
  earnings: "Resultados",
  news: "Noticia",
  dataset: "Conjunto de datos",
  other: "Otra fuente",
};

function renderSource(source: FinancialSource): Element {
  const details: Element[] = [externalLink(source.label, source.url)];
  details.push(element("p", [text([
    source.organization,
    sourceTypeLabels[source.type],
  ].filter(Boolean).join(" · "))], { className: ["financial-sources__meta"] }));
  if (source.publishedAt) {
    details.push(element("p", [
      text("Publicado: "),
      element("time", [text(formatFinancialDate(source.publishedAt))], { dateTime: source.publishedAt }),
    ]));
  }
  if (source.period) {
    details.push(element("p", [text(`Periodo: ${source.period.label}`)]));
  }
  if (source.accessedAt) {
    details.push(element("p", [
      text("Consultado: "),
      element("time", [text(formatFinancialDate(source.accessedAt))], { dateTime: source.accessedAt }),
    ]));
  }
  return element("li", details);
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
