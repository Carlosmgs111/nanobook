import { z } from "zod";
import type { ComponentBlockDefinition } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";

/**
 * Componente de demostración del mecanismo de bloques de framework. Se puede
 * borrar junto con `CounterDemo.tsx` cuando exista el primer componente real.
 */
const definition: ComponentBlockDefinition = {
  name: "counter-demo",
  props: z.object({
    label: z.string().max(80).default("Contador"),
    start: z.number().int().default(0),
  }),
};

export default definition;
