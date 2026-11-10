import type { ComponentBlockDefinition } from "../../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { priceChartProps } from "./PriceChart.schema";

/** Gráfico de precios: se renderiza en el servidor y se hidrata al entrar en el viewport. */
const definition: ComponentBlockDefinition = {
  name: "price-chart",
  hydrate: "visible",
  props: priceChartProps,
};

export default definition;
