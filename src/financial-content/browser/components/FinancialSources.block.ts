import type { ComponentBlockDefinition } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { financialBlockProps } from "../../shared/components/financialBlockProps";

/** Ficha financiera `financial-sources`: HTML del servidor, sin JavaScript en el navegador. */
const definition: ComponentBlockDefinition = {
  name: "financial-sources",
  props: financialBlockProps("financial-sources"),
};

export default definition;
