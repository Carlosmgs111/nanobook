import { describe, expect, it } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { DocumentNotFoundError, DocumentRevisionConflictError } from "../../../../documents/server/domain/errors";
import { NanobookAccessDeniedError } from "../../../../nanobooks/server/application/AuthorizeNanobook";
import { toMcpToolResult } from "./McpToolResult";

describe("toMcpToolResult", () => {
  it("serializes successful values as MCP text content", () => {
    expect(toMcpToolResult(Result.ok({ id: "book-1" }))).toEqual({
      content: [{ type: "text", text: '{"id":"book-1"}' }],
    });
  });

  it.each([
    [new NanobookAccessDeniedError("book-1", "write"), 403],
    [new DocumentNotFoundError("doc-1"), 404],
    [new DocumentRevisionConflictError("doc-1", 2, 3), 409],
  ])("maps expected domain failures to a stable code", (error, code) => {
    const response = toMcpToolResult(Result.fail(error));
    expect(response.isError).toBe(true);
    expect(JSON.parse(response.content[0].text)).toMatchObject({ code });
  });

  it("does not expose an unexpected internal error", () => {
    const response = toMcpToolResult(Result.fail(new Error("connection string leaked")));
    expect(response.content[0].text).toBe('{"code":500,"error":"La operación no pudo completarse"}');
  });
});
