import type { ZodType } from "zod";

/**
 * Un bloque que `rendering` sabe pintar cuando un documento invoca su fence.
 *
 * - `name` es el lenguaje de la fence.
 * - `component` es la ruta, desde la raíz del proyecto, del componente `.astro`
 *   que lo pinta. Es un texto (no un import) para que el registro se pueda cargar
 *   también en el Worker de la vista previa, que no puede cargar componentes.
 *   Si el bloque debe hidratarse, el propio `.astro` lo declara con `client:*`.
 * - `props` es el esquema zod que valida el contenido de la fence.
 */
export interface ComponentBlockDefinition {
  readonly name: string;
  readonly component: string;
  readonly props: ZodType<unknown>;
}
