import { describe, expect, it } from "vitest";
import { financialBlockProps } from "./financialBlockProps";

const source = {
  id: "example",
  label: "Fuente",
  url: "https://example.com/data",
  type: "dataset",
  period: { label: "2024" },
};
const metrics = {
  version: 1,
  metrics: [
    { label: "Margen", value: 12, unit: "percent", period: { label: "2024" }, sourceIds: ["example"] },
  ],
  sources: [source],
};

describe("financialBlockProps", () => {
  it("accepts a block without kind, which the fence name supplies", () => {
    const parsed = financialBlockProps("financial-metrics").parse(metrics);

    expect(parsed.kind).toBe("financial-metrics");
  });

  it("assumes version 1 when the author omits it", () => {
    const { version: _omitted, ...withoutVersion } = metrics;

    expect(financialBlockProps("financial-metrics").parse(withoutVersion).version).toBe(1);
  });

  it("rejects another version with the contract's message and path", () => {
    const result = financialBlockProps("financial-metrics").safeParse({ ...metrics, version: 2 });

    expect(result.success).toBe(false);
    const [issue] = result.error!.issues;
    expect(issue.path).toEqual(["version"]);
    expect(issue.message).toBe("La versión del bloque debe ser 1.");
  });

  it("ignores a kind written by the author", () => {
    const parsed = financialBlockProps("financial-metrics").parse({ ...metrics, kind: "financial-news" });

    expect(parsed.kind).toBe("financial-metrics");
  });

  it("keeps the strict validation of the original schema", () => {
    const result = financialBlockProps("financial-metrics").safeParse({
      ...metrics,
      metrics: [{ ...metrics.metrics[0], sourceIds: ["missing"] }],
    });

    expect(result.success).toBe(false);
  });

  it.each([null, "texto", [1, 2]])("rejects a payload that is not an object: %j", (payload) => {
    expect(financialBlockProps("financial-metrics").safeParse(payload).success).toBe(false);
  });
});
