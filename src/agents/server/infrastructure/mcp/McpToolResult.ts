import { Result } from "../../../../shared/domain/Result";
import {
  DocumentAccessDeniedError,
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  DocumentRevisionConflictError,
  ParentNotFoundError,
} from "../../../../documents/server/domain/errors";
import { NanobookAccessDeniedError } from "../../../../nanobooks/server/application/AuthorizeNanobook";
import { NanobookNotFoundError } from "../../../../nanobooks/server/application/errors";
import { AgentScopeDeniedError } from "../../application/errors";
import type { MarkdownBlockIssue } from "../../application/ports/MarkdownBlockAdvisor";

type McpError = { code: number; error: string };

/**
 * Resultado de una herramienta como JSON. `notes` añade un segundo bloque de
 * texto solo si la operación salió bien; el primero conserva su forma para no
 * romper a los clientes que leen `documentId` o `revision` de él.
 */
export function toMcpToolResult(result: Result<unknown, unknown>, notes?: string) {
  if (result.isSuccess) {
    const content = [
      { type: "text" as const, text: JSON.stringify(result.getValue()) },
    ];
    if (notes) content.push({ type: "text" as const, text: notes });
    return { content };
  }

  const error = result.getError();
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(toMcpError(error)) },
    ],
    isError: true,
  };
}

/** Como `toMcpToolResult`, pero un valor de texto se entrega tal cual, sin comillas ni escapes. */
export function toMcpTextResult(result: Result<unknown, unknown>) {
  if (result.isSuccess && typeof result.getValue() === "string") {
    return { content: [{ type: "text" as const, text: result.getValue() as string }] };
  }
  return toMcpToolResult(result);
}

/** Aviso legible para el agente sobre bloques inválidos; `undefined` si no hay ninguno. */
export function formatBlockIssues(issues: readonly MarkdownBlockIssue[]): string | undefined {
  if (issues.length === 0) return undefined;
  const lines = issues.map(({ block, line, path, message }) =>
    `- línea ${line} · ${block}${path ? ` · ${path}` : ""}: ${message}`,
  );
  return [
    `Aviso: el documento se guardó, pero ${issues.length} problema(s) en sus bloques impedirán mostrarlos bien:`,
    ...lines,
    "Corrígelos con update_document (usa el id y la revisión devueltos). Si dudas del formato, consulta get_markdown_blocks_guide.",
  ].join("\n");
}

/** Une los avisos presentes en un solo texto; `undefined` si no hay ninguno. */
export function joinNotes(...notes: ReadonlyArray<string | undefined>): string | undefined {
  const present = notes.filter((note): note is string => Boolean(note));
  return present.length > 0 ? present.join("\n\n") : undefined;
}

function toMcpError(error: unknown): McpError {
  if (
    error instanceof AgentScopeDeniedError ||
    error instanceof NanobookAccessDeniedError ||
    error instanceof DocumentAccessDeniedError
  ) {
    return { code: 403, error: error.message };
  }
  if (
    error instanceof NanobookNotFoundError ||
    error instanceof DocumentNotFoundError ||
    error instanceof ParentNotFoundError
  ) {
    return { code: 404, error: error.message };
  }
  if (
    error instanceof DocumentAlreadyExistsError ||
    error instanceof DocumentRevisionConflictError
  ) {
    return { code: 409, error: error.message };
  }
  return { code: 500, error: "La operación no pudo completarse" };
}
