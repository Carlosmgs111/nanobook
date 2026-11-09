import type { ZodType } from "zod";

/** Directivas `client:*` que un bloque puede pedir. Sin ninguna, el bloque es solo HTML del servidor. */
export const BLOCK_HYDRATION_DIRECTIVES = ["load", "idle", "visible"] as const;

export type BlockHydration = (typeof BLOCK_HYDRATION_DIRECTIVES)[number];

/**
 * Contrato puro de un componente embebible en Markdown. El nombre es el
 * lenguaje de la fence. `hydrate` es opcional: sin él, el componente se
 * renderiza en el servidor y no envía JavaScript; con él, Astro lo hidrata en
 * el navegador con la directiva `client:<hydrate>`. Un `.astro` no puede hidratarse.
 */
export interface ComponentBlockDefinition {
  readonly name: string;
  readonly props: ZodType<unknown>;
  readonly hydrate?: BlockHydration;
}
