import type { ComponentBlockDefinition } from "../../rendering/shared";
import { spreadsheetProps } from "./components/Spreadsheet/Spreadsheet.schema";
import { spreadsheetTotalsProps } from "./components/SpreadsheetTotals/SpreadsheetTotals.schema";

const components = "/src/spreadsheets/browser/components";

/** Bloques que aporta `spreadsheets`: datos puros (rutas y esquemas) que también carga el Worker de la vista previa. */
export const spreadsheetBlocks: readonly ComponentBlockDefinition[] = [
  {
    name: "spreadsheet",
    component: `${components}/Spreadsheet/Spreadsheet.astro`,
    props: spreadsheetProps,
  },
  {
    name: "spreadsheet-totals",
    component: `${components}/SpreadsheetTotals/SpreadsheetTotals.astro`,
    props: spreadsheetTotalsProps,
  },
];
