import { createMcpHandler } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";
import { createMarkdownBlockAdvisor } from "../../../../application/server/createMarkdownBlockAdvisor";
import { financialGuideExamples } from "../../../../financial-content/shared/guide/financialAuthoringGuide";
import { Result } from "../../../../shared/domain/Result";
import type { NanobookModule } from "../../../../nanobooks/server";
import { AgentToolService } from "../../application/AgentToolService";
import type { AgentActor } from "../../application/dto";
import { createNanobookMcpServer, NANOBOOK_MCP_INSTRUCTIONS } from "./createNanobookMcpServer";

const actor: AgentActor = {
  actorId: "owner",
  oauthClientId: "claude",
  scopes: ["nanobooks:read", "nanobooks:write"],
};

function createdDocument() {
  return { getDocumentId: () => ({ getValue: () => "doc-1" }), revision: 1 };
}

function connect(scopes: readonly string[] = actor.scopes) {
  const createDocument = vi.fn().mockResolvedValue(Result.ok(createdDocument()));
  const updateDocument = vi.fn().mockResolvedValue(Result.ok(createdDocument()));
  const nanobooks = {
    requireNanobookAccess: { execute: vi.fn().mockResolvedValue(Result.ok({})) },
    documentModule: {
      createDocument: { execute: createDocument },
      updateDocument: { execute: updateDocument },
    },
  } as unknown as NanobookModule;
  const tools = new AgentToolService(nanobooks, { write: vi.fn() }, createMarkdownBlockAdvisor());
  const handler = createMcpHandler(
    () => createNanobookMcpServer({ ...actor, scopes }, tools),
    { legacy: "stateless", responseMode: "json" },
  );

  let id = 0;
  async function rpc(method: string, params: Record<string, unknown> = {}) {
    const response = await handler.fetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
      }),
    );
    const body = await response.text();
    // Según los encabezados, el manejador responde con JSON o con un evento SSE.
    const payload = body.trimStart().startsWith("{")
      ? body
      : body.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("");
    return JSON.parse(payload) as { result?: any; error?: unknown };
  }
  const init = () =>
    rpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
  return { rpc, init, createDocument, updateDocument };
}

const documentArgs = (content: string, path = "nota") => ({
  nanobookId: "book-1",
  path,
  title: "Nota",
  description: "Una nota",
  content,
});

describe("nanobook MCP server, as an agent sees it", () => {
  it("announces the financial blocks in the server instructions", async () => {
    const { init } = connect();
    const { result } = await init();

    expect(result.instructions).toBe(NANOBOOK_MCP_INSTRUCTIONS);
    expect(result.instructions).toContain("get_markdown_blocks_guide");
    expect(result.instructions).toContain("validate_markdown_blocks");
    expect(result.instructions).toMatch(/Nunca inventes/);
  });

  it("describes every tool and registers the two block tools", async () => {
    const { rpc, init } = connect();
    await init();
    const { result } = await rpc("tools/list");

    const names = result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "list_nanobooks", "get_nanobook", "create_nanobook", "update_nanobook", "list_documents",
        "get_document", "create_document", "update_document", "get_markdown_blocks_guide",
        "validate_markdown_blocks",
      ]),
    );
    for (const tool of result.tools) {
      expect(tool.description, `${tool.name} sin descripción`).toBeTruthy();
    }
  });

  it("serves the guide as plain Markdown text that contains a template for every block", async () => {
    const { rpc, init } = connect();
    await init();
    const { result } = await rpc("tools/call", { name: "get_markdown_blocks_guide", arguments: {} });

    const text: string = result.content[0].text;
    expect(text.startsWith("# Guía")).toBe(true);
    for (const name of Object.keys(financialGuideExamples)) expect(text).toContain(`\`\`\`${name}\n`);
  });

  it("validates a bad block and returns where and why", async () => {
    const { rpc, init } = connect();
    await init();
    const bad = ["# Nota", "", "```financial-chartt", "chart: line", "```"].join("\n");
    const { result } = await rpc("tools/call", {
      name: "validate_markdown_blocks",
      arguments: { content: bad },
    });

    const report = JSON.parse(result.content[0].text);
    expect(report.valid).toBe(false);
    expect(report.issues[0]).toMatchObject({ block: "financial-chartt", line: 3 });
  });

  it("reports a document with only valid blocks as valid", async () => {
    const { rpc, init } = connect();
    await init();
    const good = ["```price-chart", financialGuideExamples["price-chart"], "```"].join("\n");
    const { result } = await rpc("tools/call", {
      name: "validate_markdown_blocks",
      arguments: { content: good },
    });

    expect(JSON.parse(result.content[0].text)).toEqual({ valid: true, issues: [] });
  });

  it("saves a document with an invalid block but warns the agent in a second message", async () => {
    const { rpc, init, createDocument } = connect();
    await init();
    const bad = ["```price-chart", ": : [", "```"].join("\n");
    const { result } = await rpc("tools/call", { name: "create_document", arguments: documentArgs(bad) });

    expect(createDocument).toHaveBeenCalledOnce();
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(2);
    expect(result.content[1].text).toContain("el documento se guardó");
    expect(result.content[1].text).toContain("línea 1 · price-chart");
    expect(result.content[1].text).toContain("update_document");
  });

  it("adds no warning when every block is valid", async () => {
    const { rpc, init } = connect();
    await init();
    const good = ["Texto", "", "```price-chart", financialGuideExamples["price-chart"], "```"].join("\n");
    const { result } = await rpc("tools/call", { name: "create_document", arguments: documentArgs(good) });

    expect(result.content).toHaveLength(1);
  });

  it("tells the agent up front that the index document shows no content", async () => {
    const { init } = connect();
    const { result } = await init();
    const text: string = result.instructions;

    expect(text).toContain("El documento índice no muestra contenido");
    expect(text).toContain("root-<nanobookId>");
    expect(text).toContain("siempre además al menos un documento propio");
    expect(text).toContain("create_document");
  });

  it("repeats the index rule in the descriptions an agent reads when it decides", async () => {
    const { rpc, init } = connect();
    await init();
    const { result } = await rpc("tools/list");
    const description = (name: string): string =>
      result.tools.find((tool: { name: string }) => tool.name === name).description;

    expect(description("create_nanobook")).toMatch(/NO muestra contenido/);
    expect(description("create_nanobook")).toContain("create_document");
    expect(description("create_document")).toContain("/index");
    expect(description("update_document")).toMatch(/solo el título y la descripción/);
  });

  it("warns when information is written to the index, since its page never shows it", async () => {
    const { rpc, init, createDocument } = connect();
    await init();
    const { result } = await rpc("tools/call", {
      name: "create_document",
      arguments: documentArgs("# Portada\n\nInformación importante.", "index"),
    });

    expect(createDocument).toHaveBeenCalledOnce();
    expect(result.content).toHaveLength(2);
    expect(result.content[1].text).toContain("documento índice");
    expect(result.content[1].text).toContain("create_document");
  });

  it("combines the index warning and the block warnings in a single note", async () => {
    const { rpc, init, updateDocument } = connect();
    await init();
    const content = ["# Portada", "", "```price-chart", ": : [", "```"].join("\n");
    const { result } = await rpc("tools/call", {
      name: "update_document",
      arguments: { ...documentArgs(content, "seccion/index"), id: "doc-1" },
    });

    expect(updateDocument).toHaveBeenCalledOnce();
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(2);
    expect(result.content[1].text).toContain("price-chart");
    expect(result.content[1].text).toContain("documento índice");
  });

  it("adds no index warning for the title the system writes or for an ordinary document", async () => {
    const { rpc, init } = connect();
    await init();

    const system = await rpc("tools/call", {
      name: "update_document",
      arguments: { ...documentArgs("# Mi nanobook\n", "index"), id: "root-1" },
    });
    const ordinary = await rpc("tools/call", {
      name: "create_document",
      arguments: documentArgs("# Resumen\n\nTexto", "resumen"),
    });

    for (const response of [system, ordinary]) {
      expect(response.result.isError).toBeUndefined();
      expect(response.result.content).toHaveLength(1);
    }
  });

  it("does not let an actor without the read scope fetch the guide", async () => {
    const { rpc, init } = connect([]);
    await init();
    const { result } = await rpc("tools/call", { name: "get_markdown_blocks_guide", arguments: {} });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ code: 403 });
  });
});
