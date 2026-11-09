import type { ComponentBlockDefinition } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { priceChartProps } from "../../shared/components/priceChart";

/**
 * Versión de `price-chart` como isla de React (SSR más hidratación). Reutiliza el
 * esquema de props del original; `price-chart` sigue montándose solo en el cliente.
 */
const definition: ComponentBlockDefinition = {
  name: "price-chart-island",
  hydrate: "visible",
  props: priceChartProps,
};

export default definition;
