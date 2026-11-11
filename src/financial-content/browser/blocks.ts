import type { ComponentBlockDefinition } from "../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { financialBlockProps } from "../shared/components/financialBlockProps";
import { companyProfileSchema } from "./components/CompanyProfile/CompanyProfile.schema";
import { financialChartSchema } from "./components/FinancialChart/FinancialChart.schema";
import { financialMetricsSchema } from "./components/FinancialMetrics/FinancialMetrics.schema";
import { financialNewsSchema } from "./components/FinancialNews/FinancialNews.schema";
import { financialSourcesSchema } from "./components/FinancialSources/FinancialSources.schema";
import { priceChartProps } from "./components/PriceChart/PriceChart.schema";

const components = "/src/financial-content/browser/components";

/**
 * Bloques que aporta `financial-content`. Son datos puros (rutas y esquemas, sin
 * importar ningún componente) para que también los cargue el Worker de la vista
 * previa. `application` los registra en `rendering`.
 */
export const financialBlocks: readonly ComponentBlockDefinition[] = [
  {
    name: "company-profile",
    component: `${components}/CompanyProfile/CompanyProfile.astro`,
    props: financialBlockProps("company-profile", companyProfileSchema),
  },
  {
    name: "financial-chart",
    component: `${components}/FinancialChart/FinancialChart.astro`,
    props: financialBlockProps("financial-chart", financialChartSchema),
  },
  {
    name: "financial-metrics",
    component: `${components}/FinancialMetrics/FinancialMetrics.astro`,
    props: financialBlockProps("financial-metrics", financialMetricsSchema),
  },
  {
    name: "financial-news",
    component: `${components}/FinancialNews/FinancialNews.astro`,
    props: financialBlockProps("financial-news", financialNewsSchema),
  },
  {
    name: "financial-sources",
    component: `${components}/FinancialSources/FinancialSources.astro`,
    props: financialBlockProps("financial-sources", financialSourcesSchema),
  },
  {
    name: "price-chart",
    component: `${components}/PriceChart/PriceChart.astro`,
    props: priceChartProps,
  },
];
