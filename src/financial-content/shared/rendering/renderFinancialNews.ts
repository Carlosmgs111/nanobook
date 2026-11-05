import type { Element, Text } from "hast";
import { formatFinancialDate } from "../formatting/formatFinancialDate";
import type { FinancialNewsBlock } from "../model/FinancialBlock";
import { element, externalLink, financialId, text } from "./hast";
import type { FinancialRenderContext } from "./renderFinancialBlock";

export function renderFinancialNews(block: FinancialNewsBlock, context: FinancialRenderContext): Element {
  const headingId = financialId("news", context.blockIndex, "heading");
  const sources = new Map(block.sources.map((source) => [source.id, source]));
  const children = [element("h2", [text(block.title ?? "Noticias financieras")], { id: headingId })];
  if (block.description) children.push(element("p", [text(block.description)]));

  for (const item of block.items) {
    // Validation guarantees that each article references a source in the block.
    const source = sources.get(item.sourceId)!;
    const metadata: Array<Element | Text> = [text(source.organization ?? source.label)];
    if (source.publishedAt) {
      metadata.push(text(" · "), element("time", [text(formatFinancialDate(source.publishedAt))], {
        dateTime: source.publishedAt,
      }));
    } else if (source.period) {
      metadata.push(text(` · ${source.period.label}`));
    }

    const article = [
      element("h3", [externalLink(item.title, source.url)]),
      element("p", metadata, { className: ["financial-news__meta"] }),
      element("p", [text(item.summary)]),
    ];
    if (item.relatedTickers?.length) {
      article.push(element("p", [text(`Tickers: ${item.relatedTickers.join(", ")}`)], {
        className: ["financial-news__references"],
      }));
    }
    if (item.mentionedMetrics?.length) {
      article.push(element("p", [text(`Métricas: ${item.mentionedMetrics.join(", ")}`)], {
        className: ["financial-news__references"],
      }));
    }
    children.push(element("article", article, { className: ["financial-news__article"] }));
  }

  return element("section", children, {
    className: ["financial-block", "financial-news"],
    ariaLabelledBy: headingId,
  });
}
