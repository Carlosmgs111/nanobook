import type { Element, Properties, Text } from "hast";
import type { HttpsUrl } from "../model/FinancialSource";

export function financialId(kind: string, blockIndex: number, part: string): string {
  return `financial:${kind}-${blockIndex}-${part}`;
}

export function text(value: string): Text {
  return { type: "text", value };
}

export function element(
  tagName: string,
  children: Array<Element | Text> = [],
  properties: Properties = {},
): Element {
  return { type: "element", tagName, properties, children };
}

export function externalLink(label: string, url: HttpsUrl): Element {
  return element("a", [text(label)], {
    href: url,
    target: "_blank",
    rel: ["noopener", "noreferrer", "external"],
  });
}
