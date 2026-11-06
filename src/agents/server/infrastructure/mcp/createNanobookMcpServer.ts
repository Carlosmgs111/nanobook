import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { AgentToolService } from "../../application/AgentToolService";
import type { AgentActor } from "../../application/dto";
import { indexBodyWarning } from "../../application/indexDocumentAdvice";
import {
  formatBlockIssues,
  joinNotes,
  toMcpTextResult,
  toMcpToolResult,
} from "./McpToolResult";

/**
 * Se entrega al cliente al iniciar la sesión. Es lo único que el agente sabe
 * del servicio antes de llamar a una herramienta, así que debe decirle que los
 * bloques financieros existen y cómo usarlos sin inventar datos.
 */
export const NANOBOOK_MCP_INSTRUCTIONS = `Nanobook organiza documentos Markdown dentro de nanobooks. Cada documento tiene metadatos (path, title, description, tags…) y un \`content\` en Markdown.

El documento índice no muestra contenido. Todo nanobook nace con un documento \`index\` (su id es \`root-<nanobookId>\`) y lo mismo vale para cualquier path que termine en \`/index\`: su página solo muestra el título, la descripción y la lista de los documentos que cuelgan de él, y NO muestra su cuerpo. Nunca pongas información ahí. Al crear un nanobook, crea siempre además al menos un documento propio con create_document (por ejemplo con path \`resumen\`) y escribe en él todo el contenido; usa update_document sobre el índice solo para ajustar su título y su descripción.

Si la conversación trata de datos financieros de una empresa (cifras, precios, noticias, fuentes), preséntalos con los bloques especiales de nanobook en vez de tablas improvisadas. Sigue este orden:
1. Llama a get_markdown_blocks_guide para conocer los bloques, sus reglas y plantillas exactas.
2. Escribe el contenido con el análisis en Markdown y los bloques.
3. Llama a validate_markdown_blocks y corrige todo lo que informe.
4. Guarda con create_document o update_document.

Nunca inventes datos, fechas ni URLs: usa solo lo que obtuviste de tus fuentes en esta conversación, y cita la fuente en cada bloque. Los bloques son evidencia y contexto, no recomendaciones de inversión.

Para modificar un documento existente, léelo antes con get_document y envía su id y su revisión en update_document.`;

/** Avisos que acompañan a un guardado correcto: bloques inválidos y contenido escrito en un índice. */
function documentNotes(
  tools: AgentToolService,
  input: { path: string; content: string }
) {
  return joinNotes(
    formatBlockIssues(tools.inspectBlocks(input.content)),
    indexBodyWarning(input.path, input.content)
  );
}

export function createNanobookMcpServer(
  actor: AgentActor,
  tools: AgentToolService
) {
  const server = new McpServer(
    { name: "nanobook", version: "0.5.1" },
    { instructions: NANOBOOK_MCP_INSTRUCTIONS }
  );
  server.registerTool(
    "list_nanobooks",
    {
      description:
        "Lista los nanobooks a los que tiene acceso el usuario, con su id, slug, nombre y visibilidad.",
      inputSchema: z.object({}),
    },
    async () => toMcpToolResult(await tools.listNanobooks(actor))
  );
  server.registerTool(
    "get_nanobook",
    {
      description: "Devuelve un nanobook por su id.",
      inputSchema: z.object({ nanobookId: z.string().min(1) }),
    },
    async ({ nanobookId }) =>
      toMcpToolResult(await tools.getNanobook(actor, nanobookId))
  );
  server.registerTool(
    "create_nanobook",
    {
      description:
        "Crea un nanobook. Si no indicas visibilidad, usa private. Nace con un documento índice (`index`) que NO muestra contenido, solo título, descripción y la lista de sus documentos: crea después, siempre, al menos un documento con create_document y escribe ahí la información.",
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
      description: "Cambia el nombre, el slug o la visibilidad de un nanobook.",
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
    {
      description:
        "Lista los documentos de un nanobook, con su contenido. En nanobooks grandes la respuesta es extensa; si solo necesitas uno, usa get_document. El documento `index` es solo el índice del nanobook (su id es root-<nanobookId>).",
      inputSchema: z.object({ nanobookId: z.string().min(1) }),
    },
    async ({ nanobookId }) =>
      toMcpToolResult(await tools.listDocuments(actor, nanobookId))
  );
  server.registerTool(
    "get_document",
    {
      description:
        "Devuelve un documento por su path, con su id, su revisión y su contenido. Léelo antes de modificarlo con update_document.",
      inputSchema: z.object({
        nanobookId: z.string().min(1),
        path: z.string().min(1),
      }),
    },
    async ({ nanobookId, path }) =>
      toMcpToolResult(await tools.getDocument(actor, nanobookId, path))
  );
  server.registerTool(
    "get_markdown_blocks_guide",
    {
      description:
        "Devuelve la guía para escribir bloques financieros (perfil de empresa, métricas, gráficos, noticias, fuentes y gráfico de precios) dentro de `content`: reglas, cuándo usar cada uno y plantillas válidas. Llámala antes de escribir datos financieros en un documento.",
      inputSchema: z.object({}),
    },
    async () => toMcpTextResult(await tools.getMarkdownBlocksGuide(actor))
  );
  server.registerTool(
    "validate_markdown_blocks",
    {
      description:
        "Comprueba los bloques de un contenido Markdown con las mismas reglas que usa la publicación, sin guardar nada. Devuelve `valid` y, por cada problema, la línea, el bloque, el campo y el motivo. Úsala antes de create_document o update_document y corrige todo lo que informe.",
      inputSchema: z.object({ content: z.string() }),
    },
    async ({ content }) =>
      toMcpToolResult(await tools.validateMarkdownBlocks(actor, content))
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
    {
      description:
        "Crea un documento con la información. `content` es Markdown y admite bloques financieros; si los usas, consulta get_markdown_blocks_guide y valida con validate_markdown_blocks. No uses un path `index` ni que termine en `/index` para información: los índices no muestran su cuerpo, solo listan sus documentos. Si algún bloque es inválido o escribes cuerpo en un índice, el documento se guarda igualmente y la respuesta incluye un aviso con lo que debes corregir.",
      inputSchema: documentInput,
    },
    async ({ nanobookId, ...input }) =>
      toMcpToolResult(
        await tools.createDocument(actor, nanobookId, input),
        documentNotes(tools, input)
      )
  );
  server.registerTool(
    "update_document",
    {
      description:
        "Reemplaza un documento existente. Envía su id y, para evitar pisar cambios ajenos, expectedRevision (de get_document). `content` admite los mismos bloques que create_document y la respuesta avisa si alguno es inválido. En un documento índice (`index` o `…/index`) cambia solo el título y la descripción: su cuerpo no se muestra, así que la respuesta avisa si le escribes contenido.",
      inputSchema: documentInput.extend({
        id: z.string().min(1),
        expectedRevision: z.number().int().positive().optional(),
      }),
    },
    async ({ nanobookId, ...input }) =>
      toMcpToolResult(
        await tools.updateDocument(actor, nanobookId, input),
        documentNotes(tools, input)
      )
  );
  return server;
}
