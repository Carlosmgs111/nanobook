import { describe, expect, it } from "vitest";
import { listFrameworkBlockDefinitions } from "../shared/componentBlockDefinitions";
import { createMarkdownBlockAdvisor } from "./createMarkdownBlockAdvisor";

const fence = (lang: string, body: string) => `\`\`\`${lang}\n${body}\n\`\`\``;

describe("createMarkdownBlockAdvisor", () => {
  it("validates every registered framework block, not only price-chart", () => {
    const { validate } = createMarkdownBlockAdvisor();
    const names = listFrameworkBlockDefinitions().map(({ name }) => name);

    expect(names).toContain("counter-demo");
    const issues = validate(fence("counter-demo", "start: no-es-un-numero"));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ block: "counter-demo", path: "start" });
  });

  it("accepts a valid framework block", () => {
    const { validate } = createMarkdownBlockAdvisor();

    expect(validate(fence("counter-demo", "label: Hola\nstart: 2"))).toEqual([]);
  });

  it("accepts the authoring guide's own price-chart example", () => {
    const { validate, guide } = createMarkdownBlockAdvisor();

    expect(validate(guide())).toEqual([]);
  });
});
