import type { Element } from "hast";
import { formatFinancialDate } from "../formatting/formatFinancialDate";
import type { CompanyProfileBlock } from "../model/FinancialBlock";
import { element, externalLink, financialId, text } from "./hast";
import type { FinancialRenderContext } from "./renderFinancialBlock";

export function renderCompanyProfile(block: CompanyProfileBlock, context: FinancialRenderContext): Element {
  const { company } = block;
  const title = block.title ?? company.name;
  const headingId = financialId("company", context.blockIndex, "heading");
  const fields: Array<[string, string | Element]> = [
    ["Ticker", company.ticker],
    ["Bolsa", company.exchange],
    ["País", company.country],
    ["Industria", company.industry],
    ["Moneda de reporte", company.reportingCurrency],
    ["Fecha de corte", element("time", [text(formatFinancialDate(company.asOf))], { dateTime: company.asOf })],
  ];
  if (title !== company.name) fields.unshift(["Empresa", company.name]);

  const children = [element("h2", [text(title)], { id: headingId })];
  if (block.description) children.push(element("p", [text(block.description)]));
  children.push(
    element("p", [text(company.description)]),
    element("dl", fields.flatMap(([label, value]) => [
      element("dt", [text(label)]),
      element("dd", [typeof value === "string" ? text(value) : value]),
    ])),
  );

  if (company.links?.length) {
    children.push(
      element("h3", [text("Enlaces")], { id: financialId("company", context.blockIndex, "links") }),
      element("ul", company.links.map(({ label, url }) => element("li", [externalLink(label, url)])), {
        className: ["financial-company__links"],
      }),
    );
  }

  const sourceIds = new Set(company.sourceIds);
  const citedSources = block.sources.filter(({ id }) => sourceIds.has(id));
  children.push(
    element("h3", [text("Fuentes")], { id: financialId("company", context.blockIndex, "sources") }),
    element("ul", citedSources.map(({ label, url }) => element("li", [externalLink(label, url)])), {
      className: ["financial-company__sources"],
    }),
  );

  return element("section", children, {
    className: ["financial-block", "financial-company"],
    ariaLabelledBy: headingId,
  });
}
