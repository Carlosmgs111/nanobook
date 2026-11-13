import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createBlockRegistry } from "../../rendering/shared";
import { financialGuideExamples } from "../shared/guide/financialAuthoringGuide";
import { FinancialContentModule } from "./index";

const fence = (lang: string, body: string) => `\`\`\`${lang}\n${body}\n\`\`\``;

describe("FinancialContentModule", () => {
  it("registers its blocks only when it is composed", () => {
    const blocks = createBlockRegistry();
    expect(blocks.blocks).toEqual([]);

    FinancialContentModule.create(blocks);

    expect(blocks.blocks.map(({ name }) => name).sort()).toEqual([
      "company-profile",
      "financial-chart",
      "financial-metrics",
      "financial-news",
      "financial-sources",
      "price-chart",
    ]);
  });

  it("registers components that exist", () => {
    const blocks = createBlockRegistry();
    FinancialContentModule.create(blocks);

    for (const { name, component } of blocks.blocks) {
      expect(existsSync(`.${component}`), name).toBe(true);
    }
  });

  it("advises on every block registered in the shared registry, not only its own", () => {
    const blocks = createBlockRegistry();
    const { validate } = FinancialContentModule.create(blocks).markdownBlockAdvisor;
    blocks.register([
      {
        name: "price-demo",
        component: "/src/application/browser/components/CounterDemo/CounterDemo.astro",
        props: (blocks.find("price-chart") as { props: never }).props,
      },
    ]);

    const issues = validate(fence("price-demo", "series: {}"));

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatchObject({ block: "price-demo" });
  });

  it("accepts the authoring guide's own examples", () => {
    const { validate, guide } = FinancialContentModule.create(createBlockRegistry()).markdownBlockAdvisor;

    expect(validate(guide())).toEqual([]);
    expect(Object.keys(financialGuideExamples).length).toBeGreaterThan(0);
  });
});
