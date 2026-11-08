/**
 * Trozo ordenado de un documento renderizado: HTML corriente o un bloque de
 * componente de raíz con sus props ya decodificadas.
 */
export type BlockSegment =
  | { readonly kind: "html"; readonly html: string }
  | {
      readonly kind: "block";
      readonly name: string;
      readonly props: unknown;
      /** HTML entre los marcadores (el punto de montaje original), para cuando no hay isla. */
      readonly fallbackHtml: string;
    };
