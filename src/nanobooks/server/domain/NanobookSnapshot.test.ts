import { describe, expect, it } from "vitest";
import { Nanobook } from "./Nanobook";
import {
  fromNanobookSnapshot,
  toNanobookSnapshot,
} from "./NanobookSnapshot";

describe("NanobookSnapshot", () => {
  const book = Nanobook.create({
    id: "book-1",
    ownerId: "owner-1",
    slug: "manual",
    name: "Manual",
    visibility: "public",
    settings: { theme: { kind: "official", id: "monocromo" } },
    setupStatus: "ready",
    createdAt: new Date("2026-11-01T12:00:00.000Z"),
    updatedAt: new Date("2026-11-01T12:30:00.000Z"),
  }).getValue();

  it("restores a nanobook with the persisted settings and dates", () => {
    const snapshot = toNanobookSnapshot(book);

    expect(snapshot.createdAt).toBe("2026-11-01T12:00:00.000Z");
    expect(snapshot.updatedAt).toBe("2026-11-01T12:30:00.000Z");
    expect(fromNanobookSnapshot(snapshot)?.toPersistence()).toEqual(
      book.toPersistence(),
    );
  });

  it("rejects a corrupt snapshot rather than constructing a nanobook", () => {
    expect(
      fromNanobookSnapshot({
        id: "book-1",
        ownerId: "owner-1",
        slug: "manual",
        name: "Manual",
        visibility: "public",
        settings: {},
        setupStatus: "ready",
        createdAt: "not-a-date",
        updatedAt: "2026-11-01T12:30:00.000Z",
      }),
    ).toBeNull();
  });
});
