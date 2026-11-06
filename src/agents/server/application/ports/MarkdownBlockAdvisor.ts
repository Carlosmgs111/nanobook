/** Un problema de un bloque dentro del Markdown que un agente quiere guardar. */
export interface MarkdownBlockIssue {
  readonly block: string;
  readonly line: number;
  readonly path: string;
  readonly message: string;
}

/**
 * Asesora al agente sobre los bloques especiales que admite el contenido
 * (financieros, componentes…). Es un puerto para que `agents` no dependa de
 * los módulos que definen esos bloques; la raíz de aplicación lo compone.
 */
export interface MarkdownBlockAdvisor {
  /** Guía de autoría con plantillas y reglas, en texto. */
  guide(): string;
  /** Comprueba los bloques de un contenido sin guardarlo ni renderizarlo. */
  validate(content: string): readonly MarkdownBlockIssue[];
}
