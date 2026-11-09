import type { ComponentBlockDefinition } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { financialBlockProps } from "../../shared/components/financialBlockProps";

/** Ficha financiera `company-profile`: HTML del servidor, sin JavaScript en el navegador. */
const definition: ComponentBlockDefinition = {
  name: "company-profile",
  props: financialBlockProps("company-profile"),
};

export default definition;
