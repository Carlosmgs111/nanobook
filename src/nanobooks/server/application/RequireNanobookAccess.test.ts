import { describe, expect, it } from "vitest";

import { Nanobook } from "../domain/Nanobook";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { NanobookAccessDeniedError } from "./AuthorizeNanobook";
import { NanobookNotFoundError } from "./errors";
import { RequireNanobookAccess } from "./RequireNanobookAccess";

const privateBook = Nanobook.create({
  id: "private-book", ownerId: "owner", slug: "private-book", name: "Private book",
}).getValue();
const publicBook = Nanobook.create({
  id: "public-book", ownerId: "owner", slug: "public-book", name: "Public book", visibility: "public",
}).getValue();

describe("RequireNanobookAccess", () => {
  const access = () => new RequireNanobookAccess(new InMemoryNanobookRepository([privateBook, publicBook]));

  it("allows the owner to write", async () => {
    const result = await access().execute("owner", "private-book", "write");
    expect(result.isSuccess).toBe(true);
  });

  it("allows any actor to read a public nanobook", async () => {
    const result = await access().execute("visitor", "public-book", "read");
    expect(result.isSuccess).toBe(true);
  });

  it("denies reading a private nanobook to another actor", async () => {
    const result = await access().execute("visitor", "private-book", "read");
    expect(result.getError()).toBeInstanceOf(NanobookAccessDeniedError);
  });

  it("denies writing another actor's nanobook", async () => {
    const result = await access().execute("visitor", "public-book", "write");
    expect(result.getError()).toBeInstanceOf(NanobookAccessDeniedError);
  });

  it("reports a missing nanobook", async () => {
    const result = await access().execute("owner", "missing", "read");
    expect(result.getError()).toBeInstanceOf(NanobookNotFoundError);
  });
});
