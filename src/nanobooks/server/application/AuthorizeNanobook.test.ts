import { describe, expect, it } from "vitest";
import { Nanobook } from "../domain/Nanobook";
import { AuthorizeNanobook, NanobookAccessDeniedError } from "./AuthorizeNanobook";

function create(visibility: "public" | "private") {
  return Nanobook.create({
    id: "book-1",
    ownerId: "owner-1",
    slug: "book",
    name: "Book",
    visibility,
  }).getValue();
}

describe("AuthorizeNanobook", () => {
  it("allows public reads but keeps writes with the owner", () => {
    const authorization = new AuthorizeNanobook();
    const book = create("public");

    expect(authorization.canRead(book)).toBe(true);
    expect(authorization.canWrite(book, "another-user")).toBe(false);
    expect(() => authorization.assert(book, "write", "another-user"))
      .toThrow(NanobookAccessDeniedError);
  });

  it("requires the owner for private reads and writes", () => {
    const authorization = new AuthorizeNanobook();
    const book = create("private");

    expect(authorization.canRead(book, "owner-1")).toBe(true);
    expect(authorization.canRead(book, "another-user")).toBe(false);
    expect(authorization.canWrite(book, "owner-1")).toBe(true);
  });
});
