import type { ComponentBlockDefinition } from "../../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { financialBlockProps } from "../../../shared/components/financialBlockProps";
import { financialChartSchema } from "./FinancialChart.schema";

/** Ficha financiera `financial-chart`: HTML del servidor, sin JavaScript en el navegador. */
const definition: ComponentBlockDefinition = {
  name: "financial-chart",
  props: financialBlockProps("financial-chart", financialChartSchema),
};

export default definition;
