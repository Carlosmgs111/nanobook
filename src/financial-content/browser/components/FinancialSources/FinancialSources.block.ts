import type { ComponentBlockDefinition } from "../../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { financialBlockProps } from "../../../shared/components/financialBlockProps";
import { financialSourcesSchema } from "./FinancialSources.schema";

/** Ficha financiera `financial-sources`: HTML del servidor, sin JavaScript en el navegador. */
const definition: ComponentBlockDefinition = {
  name: "financial-sources",
  props: financialBlockProps("financial-sources", financialSourcesSchema),
};

export default definition;
