import type { FinancialFenceKind } from "../model/FinancialBlock";

const messages = {
  "invalid-yaml": "El contenido debe ser un documento YAML válido.",
  "yaml-alias": "El bloque no admite alias YAML.",
  "yaml-tag": "El bloque solo admite etiquetas del esquema core de YAML.",
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

export type FinancialBlockParseErrorCode = keyof typeof messages;
export type FinancialBlockPath = readonly (string | number)[];

export class FinancialBlockParseError extends Error {
  constructor(
    public readonly kind: FinancialFenceKind,
    public readonly code: FinancialBlockParseErrorCode,
    public readonly path: FinancialBlockPath = [],
  ) {
    super(messages[code]);
    this.name = "FinancialBlockParseError";
  }
}
