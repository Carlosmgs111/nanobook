import { describe, expect, it } from "vitest";
import { Document } from "../domain/Document";
import { DocumentReference } from "../domain/DocumentReference";
import type { ContentEntry } from "../domain/types";
import type { ReferenceResolver } from "../domain/reference/types";
import { ProxyParser } from "./ProxyParser";

describe("ProxyParser", () => {
  it("preserves the source ref after resolving proxy content", async () => {
    const source = Document.create(
      "new-dir/newfile3",
      {
        id: "source-id",
        title: "Proxy",
        description: "Proxy",
        date: new Date("2026-01-01"),
        ref: "/README.md",
      },
      ""
    ).getValue();
    const target: ContentEntry = {
      id: source.getDocumentId(),
      data: {
        title: "README",
        description: "README",
        date: new Date("2026-01-01"),
      },
      body: "# README",
    };
    const resolver: ReferenceResolver = {
      resolve: async (ref: DocumentReference) => {
        expect(ref.getValue()).toBe("/README.md");
        return target;
      },
    };

    const resolved = await new ProxyParser(resolver).parseProxy(source);

    expect(resolved?.getMetadata().ref).toBe("/README.md");
    expect(resolved?.getRawFrontmatter()).toContain('ref: "/README.md"');
  });
});
