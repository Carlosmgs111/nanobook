import type { Element } from "hast";
import type { FinancialFenceKind } from "../model/FinancialBlock";
import { formatFinancialBlockPath, type FinancialBlockParseError } from "../parsing/FinancialBlockParseError";
import { element, financialId, text } from "./hast";

function errorSection(kind: FinancialFenceKind, blockIndex: number, detail: Element[]): Element {
  const headingId = financialId("error", blockIndex, "heading");
  return element("section", [
    element("h2", [text(`No se pudo mostrar ${kind} (bloque ${blockIndex + 1})`)], { id: headingId }),
    ...detail,
  ], {
    className: ["financial-block", "financial-block--error"],
    ariaLabelledBy: headingId,
  });
}

export function renderFinancialError({ kind, blockIndex, error }: {
  kind: FinancialFenceKind;
  blockIndex: number;
  error: FinancialBlockParseError;
}): Element {
  const path = formatFinancialBlockPath(error.path);

  const detail = [element("p", [text(error.message)])];
  if (path) detail.unshift(element("p", [text("Campo "), element("code", [text(path)])]));
  return errorSection(kind, blockIndex, detail);
}

export function renderUnavailableFinancialBlock(kind: FinancialFenceKind, blockIndex: number): Element {
  return errorSection(kind, blockIndex, [
    element("p", [text("La visualización de este bloque no está disponible.")]),
  ]);
}
