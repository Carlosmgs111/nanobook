import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { AgentToolService } from "../../application/AgentToolService";
import type { AgentActor } from "../../application/dto";
import { toMcpToolResult } from "./McpToolResult";

export function createNanobookMcpServer(
  actor: AgentActor,
  tools: AgentToolService
) {
  const server = new McpServer({ name: "nanobook", version: "0.5.1" });
  server.registerTool(
    "list_nanobooks",
    { inputSchema: z.object({}) },
    async () => toMcpToolResult(await tools.listNanobooks(actor))
  );
  server.registerTool(
    "get_nanobook",
    { inputSchema: z.object({ nanobookId: z.string().min(1) }) },
    async ({ nanobookId }) =>
      toMcpToolResult(await tools.getNanobook(actor, nanobookId))
  );
  server.registerTool(
    "create_nanobook",
    {
      inputSchema: z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        visibility: z.enum(["public", "private"]).optional(),
      }),
    },
    async (input) => toMcpToolResult(await tools.createNanobook(actor, input))
  );
  server.registerTool(
    "update_nanobook",
    {
      inputSchema: z.object({
        nanobookId: z.string().min(1),
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        visibility: z.enum(["public", "private"]).optional(),
      }),
    },
    async ({ nanobookId, ...input }) =>
      toMcpToolResult(await tools.updateNanobook(actor, nanobookId, input))
  );
  server.registerTool(
    "list_documents",
    { inputSchema: z.object({ nanobookId: z.string().min(1) }) },
    async ({ nanobookId }) =>
      toMcpToolResult(await tools.listDocuments(actor, nanobookId))
  );
  server.registerTool(
    "get_document",
    {
      inputSchema: z.object({
        nanobookId: z.string().min(1),
        path: z.string().min(1),
      }),
    },
    async ({ nanobookId, path }) =>
      toMcpToolResult(await tools.getDocument(actor, nanobookId, path))
  );
  const documentInput = z.object({
    nanobookId: z.string().min(1),
    path: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    content: z.string(),
    author: z.string().optional(),
    cover: z.string().optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().optional(),
    position: z.number().int().optional(),
  });
  server.registerTool(
    "create_document",
    { inputSchema: documentInput },
    async ({ nanobookId, ...input }) =>
      toMcpToolResult(await tools.createDocument(actor, nanobookId, input))
  );
  server.registerTool(
    "update_document",
    {
      inputSchema: documentInput.extend({
        id: z.string().min(1),
        expectedRevision: z.number().int().positive().optional(),
      }),
    },
    async ({ nanobookId, ...input }) =>
      toMcpToolResult(await tools.updateDocument(actor, nanobookId, input))
  );
  return server;
}
