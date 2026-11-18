import { describe, expect, it } from "vitest";
import { DocumentReference } from "../../domain/DocumentReference";
import { LocalFileReferenceResolver } from "./LocalFileReferenceResolver";

describe("LocalFileReferenceResolver", () => {
  it("reads a project file and ignores non-local refs", async () => {
    const resolver = new LocalFileReferenceResolver();

    const entry = await resolver.resolve(new DocumentReference("/package.json"));
    expect(entry?.body).toContain('"name"');
    expect(await resolver.resolve(new DocumentReference({ source: "url", url: "https://example.com" }))).toBeNull();
  });

  it("rejects paths that escape the project root", async () => {
    await expect(new LocalFileReferenceResolver().resolve(new DocumentReference("/../outside.md"))).rejects.toThrow(/escapes project root/);
  });
});
