import { expect, it } from "vitest";
import { createMarkdownExtensions } from "./createMarkdownExtensions";

it("registers the five financial fences in each browser extension list", () => {
  const extensions = createMarkdownExtensions();

  expect(extensions.map(({ id, version }) => `${id}@${version}`)).toEqual([
    "financial-content@1",
    "financial-components@1",
  ]);
  expect(extensions[0].fenceLanguages).toEqual([
    "company-profile",
    "financial-chart",
    "financial-metrics",
    "financial-news",
    "financial-sources",
  ]);
  expect(createMarkdownExtensions()).not.toBe(extensions);
});
