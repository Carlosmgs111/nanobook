import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import { GetAllDocuments } from "./GetAllDocuments";
import type { ProxyParser } from "./ProxyParser";

describe("GetAllDocuments", () => {
  it("lists the nanobook documents with their proxies resolved", async () => {
    const stored = [{ id: "stored" }] as unknown as Document[];
    const resolved = [{ id: "resolved" }] as unknown as Document[];
    const parseProxies = vi.fn().mockResolvedValue(resolved);
    const repository = { list: vi.fn().mockResolvedValue(Result.ok(stored)) } as unknown as ContentRepository;

    const result = await new GetAllDocuments(repository, { parseProxies } as unknown as ProxyParser).execute("book");

    expect(result).toBe(resolved);
    expect(parseProxies).toHaveBeenCalledWith("book", stored);
  });

  it("returns an empty list when the repository fails", async () => {
    const repository = { list: vi.fn().mockResolvedValue(Result.fail(new Error("db"))) } as unknown as ContentRepository;

    expect(await new GetAllDocuments(repository, {} as ProxyParser).execute("book")).toEqual([]);
  });
});
