import type { ComponentBlockDefinition } from "../../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { financialBlockProps } from "../../../shared/components/financialBlockProps";
import { companyProfileSchema } from "./CompanyProfile.schema";

/** Ficha financiera `company-profile`: HTML del servidor, sin JavaScript en el navegador. */
const definition: ComponentBlockDefinition = {
  name: "company-profile",
  props: financialBlockProps("company-profile", companyProfileSchema),
};

export default definition;
