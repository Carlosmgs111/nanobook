import type { ComponentBlockDefinition } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { financialBlockProps } from "../../shared/components/financialBlockProps";

/** Ficha financiera `financial-news`: HTML del servidor, sin JavaScript en el navegador. */
const definition: ComponentBlockDefinition = {
  name: "financial-news",
  props: financialBlockProps("financial-news"),
};

export default definition;
