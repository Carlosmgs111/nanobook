import type { ComponentBlockDefinition } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { financialBlockProps } from "../../shared/components/financialBlockProps";

/** Ficha financiera `financial-chart`: HTML del servidor, sin JavaScript en el navegador. */
const definition: ComponentBlockDefinition = {
  name: "financial-chart",
  props: financialBlockProps("financial-chart"),
};

export default definition;
