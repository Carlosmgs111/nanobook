import type { Element } from "hast";
import { formatFinancialValue } from "../formatting/formatFinancialValue";
import type { FinancialMetricsBlock } from "../model/FinancialBlock";
import { element, externalLink, financialId, text } from "./hast";
import type { FinancialRenderContext } from "./renderFinancialBlock";
import { renderFinancialPeriod, renderInlineSourceTemporalMetadata } from "./renderFinancialTemporalMetadata";

const directionLabels = {
  favorable: "Favorable",
  unfavorable: "Desfavorable",
  neutral: "Neutral",
} as const;

export function renderFinancialMetrics(block: FinancialMetricsBlock, context: FinancialRenderContext): Element {
  const headingId = financialId("metrics", context.blockIndex, "heading");
  const sources = new Map(block.sources.map((source) => [source.id, source]));
  const children: Element[] = [element("h2", [text(block.title ?? "Métricas financieras")], { id: headingId })];
  if (block.description) children.push(element("p", [text(block.description)]));

  const metrics = block.metrics.map((metric, index) => {
    const descriptionId = financialId("metrics", context.blockIndex, `metric-${index}-description`);
    const details: Element[] = [
      element("p", [text(formatFinancialValue(metric))], { className: ["financial-metrics__value"] }),
      element("p", renderFinancialPeriod(metric.period), { className: ["financial-metrics__period"] }),
    ];

    if (metric.description) {
      details.push(element("p", [text(metric.description)], { id: descriptionId }));
    }
    if (metric.comparison) {
      details.push(element("p", [
        text(`${metric.comparison.label}: ${formatFinancialValue({ ...metric, value: metric.comparison.value })} · ${directionLabels[metric.comparison.direction]}`),
      ], {
        className: ["financial-metrics__comparison"],
        dataDirection: metric.comparison.direction,
      }));
    }

    const citedSources = metric.sourceIds.map((id): Element => {
      const source = sources.get(id);
      return element("li", source
        ? [externalLink(source.label, source.url), ...renderInlineSourceTemporalMetadata(source)]
        : [text("Fuente no disponible")]);
    });
    details.push(element("ul", citedSources, { className: ["financial-metrics__sources"] }));

    return element("div", [
      element("dt", [text(metric.label)]),
      element("dd", details, metric.description ? { ariaDescribedBy: descriptionId } : {}),
    ], { className: ["financial-metrics__item"] });
  });
  children.push(element("dl", metrics));

  return element("section", children, {
    className: ["financial-block", "financial-metrics"],
    ariaLabelledBy: headingId,
  });
}
