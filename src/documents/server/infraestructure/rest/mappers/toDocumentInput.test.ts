import { describe, expect, it } from "vitest";
import { toDocumentInput } from "./toDocumentInput";

describe("toDocumentInput", () => {
  it("keeps the public mutation contract closed to identity and legacy boundary fields", () => {
    const input = toDocumentInput({
      id: "document-1",
      path: "guide",
      title: "Guide",
      description: "Guide",
      content: "# Guide",
      // These values can arrive from an untyped JSON request and must be ignored.
      ownerId: "forged-owner",
      nanobook: true,
      settings: { provider: "github" },
    } as never);

    expect(input).toEqual({
      id: "document-1",
      path: "guide",
      title: "Guide",
      description: "Guide",
      content: "# Guide",
      author: undefined,
      cover: undefined,
      tags: undefined,
      draft: undefined,
      position: undefined,
      ref: undefined,
    });
    expect(input).not.toHaveProperty("ownerId");
    expect(input).not.toHaveProperty("nanobook");
    expect(input).not.toHaveProperty("settings");
  });
});
