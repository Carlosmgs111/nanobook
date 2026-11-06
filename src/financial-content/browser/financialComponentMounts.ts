import type { ComponentLoader } from "../../rendering/browser/componentRegistry";

/** Montadores cliente de los componentes de `financial-content`, por nombre de fence. */
export const financialComponentMounts: Readonly<Record<string, ComponentLoader>> = {
  "price-chart": async () => (await import("./components/priceChart")).mountPriceChart,
};
