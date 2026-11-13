import type { MarkdownExtension } from "./MarkdownExtension";
import { renderMarkdown } from "./renderMarkdown";
import { createRendererFingerprint, RENDERER_VERSION } from "./rendererFingerprint";

/** Lo que el resto de la aplicación necesita del pipeline: convertir Markdown en HTML e identificar esa configuración. */
export interface MarkdownEngine {
  /** Cambia cuando cambia el pipeline o sus extensiones; sirve de clave de caché. */
  readonly fingerprint: string;
  render(source: string): Promise<string>;
}

/** Congela una copia de las extensiones: mutar después el arreglo del llamador no altera la salida. */
export function createMarkdownEngine(extensions: readonly MarkdownExtension[] = []): MarkdownEngine {
  const configured = Object.freeze([...extensions]);
  return {
    fingerprint: createRendererFingerprint(RENDERER_VERSION, configured),
    render: (source) => renderMarkdown(source, configured),
  };
}
