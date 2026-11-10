import type { ComponentBlockDefinition } from "../../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { counterDemoProps } from "./CounterDemo.schema";

/**
 * Componente de demostración del mecanismo de bloques de framework. Se puede
 * borrar, junto con su carpeta, cuando exista el primer componente real.
 */
const definition: ComponentBlockDefinition = {
  name: "counter-demo",
  hydrate: "visible",
  props: counterDemoProps,
};

export default definition;
