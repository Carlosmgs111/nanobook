import { describe, it, expect } from "vitest";
import { ConfirmRenderedPreview } from "../ConfirmRenderedPreview";
import { buildSerializedEntry, buildRenderedPreview } from "./factories";

const savedDocument = buildSerializedEntry();
const rendered = buildRenderedPreview();
const useCase = new ConfirmRenderedPreview();

describe("ConfirmRenderedPreview", () => {
  it("rejects HTML rendered from an older revision of the saved document", () => {
    const olderDocument = { ...savedDocument, content: "# Older version" };

    const result = useCase.execute({
      savedDocument,
      renderedSource: olderDocument,
      rendered,
    });

    expect(result).toBeNull();
  });

  it("accepts HTML rendered from the exact saved revision", () => {
    const result = useCase.execute({
      savedDocument,
      renderedSource: savedDocument,
      rendered,
    });

    expect(result).toEqual(rendered);
  });

  it("returns null when any input is missing", () => {
    expect(useCase.execute({ savedDocument: null, renderedSource: savedDocument, rendered })).toBeNull();
    expect(useCase.execute({ savedDocument, renderedSource: null, rendered })).toBeNull();
    expect(useCase.execute({ savedDocument, renderedSource: savedDocument, rendered: null })).toBeNull();
  });
});
