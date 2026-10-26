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

type McpError = { code: number; error: string };

export function toMcpToolResult(result: Result<unknown, unknown>) {
  if (result.isSuccess) {
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result.getValue()) },
      ],
    };
  }

  const error = result.getError();
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(toMcpError(error)) },
    ],
    isError: true,
  };
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
