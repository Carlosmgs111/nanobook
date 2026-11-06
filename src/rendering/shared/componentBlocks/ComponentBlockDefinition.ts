import type { ZodType } from "zod";

/**
 * Contrato puro de un componente embebible en Markdown. El nombre es el
 * lenguaje de la fence y la clave del registro cliente que lo monta.
 */
export interface ComponentBlockDefinition {
  readonly name: string;
  readonly props: ZodType<unknown>;
}
