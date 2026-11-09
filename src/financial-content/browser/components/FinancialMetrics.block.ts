import type { ComponentBlockDefinition } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { financialBlockProps } from "../../shared/components/financialBlockProps";

/** Ficha financiera `financial-metrics`: HTML del servidor, sin JavaScript en el navegador. */
const definition: ComponentBlockDefinition = {
  name: "financial-metrics",
  props: financialBlockProps("financial-metrics"),
};

export default definition;
