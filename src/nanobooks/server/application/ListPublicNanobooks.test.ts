import { describe, expect, it } from "vitest";
import { Nanobook } from "../domain/Nanobook";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { ListPublicNanobooks } from "./ListPublicNanobooks";

describe("ListPublicNanobooks", () => {
  it("provides public catalog fields without exposing ownership or settings", async () => {
    const repository = new InMemoryNanobookRepository([
      Nanobook.create({ id: "one", ownerId: "owner", name: "Manual", slug: "manual", visibility: "public" }).getValue(),
      Nanobook.create({ id: "two", ownerId: "owner", name: "Secret", slug: "secret" }).getValue(),
      Nanobook.create({ id: "three", ownerId: "owner", name: "Pending", slug: "pending", visibility: "public", setupStatus: "pending" }).getValue(),
    ]);
    const result = await new ListPublicNanobooks(repository).execute();
    expect(result.getValue()).toEqual([{ name: "Manual", slug: "manual" }]);
  });
});
