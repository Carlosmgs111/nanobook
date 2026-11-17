import { describe, expect, it } from "vitest";
import { YamlDocumentContentParser } from "./YamlDocumentContentParser";
import { InvalidDocumentContentError } from "../../domain/errors";
import { buildSerializedEntry } from "../../application/test/factories";

describe("YamlDocumentContentParser", () => {
  it("separa frontmatter y cuerpo y sincroniza los campos editables", () => {
    const result = new YamlDocumentContentParser().parse(
      buildSerializedEntry(),
      '---\ntitle: "Nuevo"\nposition: 7\ntags: [a]\n---\n# Cuerpo'
    );

    expect(result.getValue()).toMatchObject({
      title: "Nuevo",
      position: 7,
      content: "# Cuerpo",
      metadata: { title: "Nuevo", tags: ["a"] },
    });
  });

  it("ignora los campos protegidos del texto editado y conserva los de la base", () => {
    const base = buildSerializedEntry({
      metadata: {
        id: "stable-id",
        author: "Original",
        ownerId: "owner-1",
        secured: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      } as never,
    });

    const result = new YamlDocumentContentParser().parse(
      base,
      '---\nid: forged\nauthor: Forged\nownerId: attacker\nsecured: false\ncreatedAt: 2099-01-01\nupdatedAt: 2099-01-02\ntitle: "Ok"\n---\n'
    );

    expect(result.getValue().metadata).toMatchObject({
      id: "stable-id",
      author: "Original",
      ownerId: "owner-1",
      secured: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      title: "Ok",
    });
  });

  it("falla con InvalidDocumentContentError ante YAML inválido", () => {
    const result = new YamlDocumentContentParser().parse(
      buildSerializedEntry(),
      "---\ntitle: [abierto\n---\n"
    );

    expect(result.getError()).toBeInstanceOf(InvalidDocumentContentError);
  });
});
