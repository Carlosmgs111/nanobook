import type { z } from "zod";

const messages = {
  "invalid-yaml": "El contenido debe ser un documento YAML válido.",
  "unsupported-version": "La versión del bloque debe ser 1.",
  "unknown-field": "El bloque contiene un campo que el contrato no admite.",
  "invalid-field": "El campo falta o su valor no cumple el contrato.",
  "invalid-url": "La URL debe ser absoluta y usar HTTPS.",
  "invalid-date": "La fecha debe existir en el calendario y usar el formato YYYY-MM-DD.",
  "invalid-number": "El valor debe ser un número finito.",
  "invalid-currency": "La moneda debe ser un código de tres letras mayúsculas. En series y métricas, la unidad currency requiere ese campo y las demás unidades lo omiten.",
  "collection-limit": "La cantidad de elementos no cumple los límites del bloque.",
  "missing-source-date": "La fuente requiere una fecha de publicación o un periodo.",
  "duplicate-source-id": "Los identificadores de fuente deben ser únicos en el bloque.",
  "missing-source-reference": "La referencia debe apuntar a una fuente del mismo bloque.",
  "duplicate-source-reference": "Cada referencia debe aparecer una sola vez en la lista.",
  "invalid-source-type": "La referencia debe apuntar a una fuente de tipo news.",
  "series-length": "La serie debe tener un valor por cada etiqueta del eje X.",
  "empty-series": "La serie debe contener al menos un número.",
  "incompatible-series": "Las series deben compartir unidad y moneda.",
};

/** Códigos con los que los esquemas etiquetan sus reglas propias (`params.code`). */
export type FinancialIssueCode = keyof typeof messages;
export type FinancialBlockPath = readonly (string | number)[];

function issueCode(issue: z.core.$ZodIssue): FinancialIssueCode {
  if (issue.path.length === 1 && issue.path[0] === "version") return "unsupported-version";
  if (issue.code === "custom") {
    return (issue.params?.code as FinancialIssueCode | undefined) ?? "invalid-field";
  }
  if (issue.code === "unrecognized_keys") return "unknown-field";
  if ((issue.code === "too_big" || issue.code === "too_small") && issue.origin === "array") {
    return "collection-limit";
  }
  if (issue.code === "invalid_format" && issue.format === "date") return "invalid-date";
  if (issue.code === "invalid_type" && issue.expected === "number") return "invalid-number";
  return "invalid-field";
}

/** Mensaje en español, con el vocabulario del contrato, de una incidencia de validación. */
export function financialIssueMessage(issue: z.core.$ZodIssue): string {
  return messages[issueCode(issue)];
}

/** Ruta de una incidencia de zod sin los símbolos, que no pueden aparecer en un documento. */
export function financialIssuePath(issue: z.core.$ZodIssue): (string | number)[] {
  return issue.path.filter((part): part is string | number => typeof part !== "symbol");
}

/** Ruta legible de un campo, por ejemplo `series[0].values`. Vacía si el error afecta a todo el bloque. */
export function formatFinancialBlockPath(path: FinancialBlockPath): string {
  return path
    .map((part, index) => {
      if (typeof part === "number") return `[${part}]`;
      return index === 0 ? part : `.${part}`;
    })
    .join("");
}
