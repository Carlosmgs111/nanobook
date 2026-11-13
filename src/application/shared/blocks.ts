import { financialBlocks } from "../../financial-content/browser/blocks";
import type { ComponentBlockDefinition } from "../../rendering/shared";
import { counterDemoProps } from "../browser/components/CounterDemo/CounterDemo.schema";

/**
 * Raíz de composición de los bloques de Markdown: aquí se registran, de forma
 * explícita, los de cada módulo. Son datos puros (los carga también el Worker de
 * la vista previa); cada entorno los pasa a `RenderingModule.create`.
 */
export const blockDefinitions: readonly ComponentBlockDefinition[] = [
  ...financialBlocks,
  {
    name: "counter-demo",
    component: "/src/application/browser/components/CounterDemo/CounterDemo.astro",
    props: counterDemoProps,
  },
];
