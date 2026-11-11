import { financialBlocks } from "../../financial-content/browser/blocks";
import { registerBlocks } from "../../rendering/shared/componentBlocks/registerBlocks";
import { counterDemoProps } from "../browser/components/CounterDemo/CounterDemo.schema";

/**
 * Raíz de composición de los bloques de Markdown: aquí se registran, de forma
 * explícita, los de cada módulo. Es la única lista que consumen la publicación,
 * la vista previa, la página y el asesor del MCP.
 */
export const blockRegistry = registerBlocks([
  ...financialBlocks,
  {
    name: "counter-demo",
    component: "/src/application/browser/components/CounterDemo/CounterDemo.astro",
    props: counterDemoProps,
  },
]);
