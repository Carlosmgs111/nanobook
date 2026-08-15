import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { saveDocument } from "./document";

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function getRequestUrl(req: IncomingMessage): URL | null {
  const host = req.headers.host;
  const url = req.url;
  if (!host || !url) return null;
  try {
    return new URL(url, `http://${host}`);
  } catch {
    return null;
  }
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let bodyText = "";
    req.on("data", (chunk: Buffer) => {
      bodyText += chunk.toString();
    });
    req.on("end", () => resolve(bodyText));
    req.on("error", (error) => reject(error));
  });
}

export interface EditorPluginOptions {
  enabled?: boolean;
}

export function editorPlugin(options: EditorPluginOptions = {}): Plugin {
  const enabled = options.enabled ?? true;

  return {
    name: "nanobook-editor",
    configureServer(server: ViteDevServer) {
      if (!enabled) return;

      server.middlewares.use(
        "/api/editor/document",
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method === "GET") {
            try {
              const url = getRequestUrl(req);
              const id = url?.searchParams.get("id");
              if (!id) {
                sendJson(res, 400, { error: "Falta el parámetro id" });
                return;
              }
              const content = await loadDocument(id);
              sendJson(res, 200, { id, content });
            } catch (error) {
              sendJson(res, 500, { error: error instanceof Error ? error.message : "Error desconocido" });
            }
            return;
          }

          if (req.method === "POST") {
            try {
              const bodyText = await readRequestBody(req);
              const { id, content } = JSON.parse(bodyText) as { id: string; content: string };
              if (!id || typeof content !== "string") {
                sendJson(res, 400, { error: "Payload inválido" });
                return;
              }
              await saveDocument(id, content);
              sendJson(res, 200, { ok: true });
            } catch (error) {
              sendJson(res, 500, { error: error instanceof Error ? error.message : "Error desconocido" });
            }
            return;
          }

          next();
        }
      );
    },
  };
}
