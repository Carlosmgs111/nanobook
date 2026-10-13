import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/navigation/server/ui/components/IndexList/DocumentIndex.astro",
  "utf8"
);

describe("DocumentIndex", () => {
  it("imports the styles that render card cover images", () => {
    expect(source).toContain(
      'import "../../../../../shared/styles/components/index-card.css"'
    );
  });
});
