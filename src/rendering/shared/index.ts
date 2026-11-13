// API pública de rendering en ambos entornos. Nadie fuera del módulo importa
// otra ruta interna (lo vigila boundary.test.ts).
export { createMarkdownEngine, type MarkdownEngine } from "./createMarkdownEngine";
export type { MarkdownExtension } from "./MarkdownExtension";
export { RENDERER_VERSION } from "./rendererFingerprint";
export { createComponentBlocksExtension } from "./componentBlocks/createComponentBlocksExtension";
export { registerBlocks, type BlockRegistry } from "./componentBlocks/registerBlocks";
export type { ComponentBlockDefinition } from "./componentBlocks/ComponentBlockDefinition";
