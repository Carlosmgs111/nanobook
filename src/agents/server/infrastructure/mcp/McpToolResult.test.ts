import { describe, expect, it } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { DocumentNotFoundError, DocumentRevisionConflictError } from "../../../../documents/server/domain/errors";
import { NanobookAccessDeniedError } from "../../../../nanobooks/server/application/AuthorizeNanobook";
import { formatBlockIssues, joinNotes, toMcpTextResult, toMcpToolResult } from "./McpToolResult";

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

  it("keeps the first content part intact and appends notes only on success", () => {
    const ok = toMcpToolResult(Result.ok({ id: "doc-1" }), "Aviso");
    expect(ok.content).toEqual([
      { type: "text", text: '{"id":"doc-1"}' },
      { type: "text", text: "Aviso" },
    ]);

    const failed = toMcpToolResult(Result.fail(new DocumentNotFoundError("doc-1")), "Aviso");
    expect(failed.content).toHaveLength(1);
  });
});

describe("toMcpTextResult", () => {
  it("delivers a string as plain text, without JSON quoting", () => {
    const guide = ["# Guía", "línea"].join("\n");
    expect(toMcpTextResult(Result.ok(guide))).toEqual({
      content: [{ type: "text", text: guide }],
    });
  });

  it("falls back to the standard mapping for failures", () => {
    const response = toMcpTextResult(Result.fail(new DocumentNotFoundError("doc-1")));
    expect(response.isError).toBe(true);
  });
});

describe("joinNotes", () => {
  it("keeps only the notes that exist, separated by a blank line", () => {
    expect(joinNotes("uno", undefined, "dos")).toBe("uno\n\ndos");
  });

  it("returns nothing when there is no note", () => {
    expect(joinNotes()).toBeUndefined();
    expect(joinNotes(undefined, undefined)).toBeUndefined();
  });
});

describe("formatBlockIssues", () => {
  it("returns nothing when every block is valid", () => {
    expect(formatBlockIssues([])).toBeUndefined();
  });

  it("lists each problem with its line, block and field, and says how to fix it", () => {
    const text = formatBlockIssues([
      { block: "financial-chart", line: 12, path: "series[0].values", message: "Falta un valor." },
      { block: "price-chart", line: 30, path: "", message: "YAML inválido." },
    ]);

    expect(text).toContain("el documento se guardó");
    expect(text).toContain("2 problema(s)");
    expect(text).toContain("- línea 12 · financial-chart · series[0].values: Falta un valor.");
    expect(text).toContain("- línea 30 · price-chart: YAML inválido.");
    expect(text).toContain("update_document");
  });
});
