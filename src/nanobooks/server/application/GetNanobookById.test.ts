import { describe, expect, it } from "vitest";

import { Nanobook } from "../domain/Nanobook";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { GetNanobookById } from "./GetNanobookById";
import { NanobookNotFoundError } from "./errors";

describe("GetNanobookById", () => {
  const book = Nanobook.create({ id: "one", ownerId: "owner", slug: "one", name: "One" }).getValue();

  it("devuelve el nanobook", async () => {
    const result = await new GetNanobookById(new InMemoryNanobookRepository([book])).execute("one");

    expect(result.getValue()).toBe(book);
  });

  it("falla con NanobookNotFoundError si no existe", async () => {
    const result = await new GetNanobookById(new InMemoryNanobookRepository([book])).execute("zzz");

    expect(result.getError()).toBeInstanceOf(NanobookNotFoundError);
  });
});
