import type { ComponentBlockDefinition } from "../../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { financialBlockProps } from "../../../shared/components/financialBlockProps";
import { financialNewsSchema } from "./FinancialNews.schema";

/** Ficha financiera `financial-news`: HTML del servidor, sin JavaScript en el navegador. */
const definition: ComponentBlockDefinition = {
  name: "financial-news",
  props: financialBlockProps("financial-news", financialNewsSchema),
};

export default definition;
