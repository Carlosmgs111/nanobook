import { expect, it } from "vitest";
import { colorInputValue, raisedColorInputValue } from "./ColorPreview";

it("shows a semi-transparent catalog color over its page background", () => {
  expect(colorInputValue("rgba(0, 0, 0, 0.12)", "#f5f5f7")).toBe("#d8d8d9");
  expect(colorInputValue("rgba(255, 255, 255, 0.03)", "#050505")).toBe("#0d0d0d");
});

it("shows an inherited raised surface as an editable RGB swatch", () => {
  expect(raisedColorInputValue("rgba(0, 0, 0, 0.03)", "#000000", "#ffffff")).toBe("#e3e3e3");
});
