import { describe, expect, it } from "vitest";

import { Document } from "../../domain/Document";
import { documentResource } from "./documentResource";

const now = new Date("2026-11-04T12:00:00.000Z");

function document(id: string, secured = true) {
  return Document.create(
    "guia",
    { id, title: id, description: "d", author: "a", ownerId: "owner-1", secured, createdAt: now, updatedAt: now },
    "# Secreto",
  ).getValue();
}

describe("documentResource", () => {
  it("construye el recurso con el id del documento almacenado y su nanobook", () => {
    expect(documentResource("nb-1", document("doc-1"))).toEqual({
      type: "document",
      id: "doc-1",
      nanobookId: "nb-1",
      attributes: { securedIds: ["doc-1"] },
    });
  });

  it("incluye el destino protegido de un proxy abierto", () => {
    const resource = documentResource("nb-1", document("proxy-1", false), document("target-1"));

    expect(resource.id).toBe("proxy-1");
    expect(resource.attributes?.securedIds).toEqual(["target-1"]);
  });

  it("incluye ambos eslabones protegidos sin repetir", () => {
    expect(documentResource("nb-1", document("doc-1"), document("target-1")).attributes?.securedIds).toEqual([
      "doc-1",
      "target-1",
    ]);
    expect(documentResource("nb-1", document("doc-1"), document("doc-1")).attributes?.securedIds).toEqual(["doc-1"]);
  });

  it("devuelve una lista vacía si ningún eslabón está protegido", () => {
    expect(documentResource("nb-1", document("doc-1", false)).attributes?.securedIds).toEqual([]);
    expect(documentResource("nb-1", document("doc-1", false), document("doc-2", false)).attributes?.securedIds).toEqual(
      [],
    );
  });
});
