import { isMap, isScalar, parseDocument, visit } from "yaml";
import type { z } from "zod";
import { Result } from "../../../shared/domain/Result";
import type { FinancialBlock, FinancialFenceKind } from "../model/FinancialBlock";
import { financialBlockSchemas } from "../validation/FinancialBlockSchemas";
import { FinancialBlockParseError } from "./FinancialBlockParseError";
import type { FinancialBlockParseErrorCode } from "./FinancialBlockParseError";

export function isFinancialFenceKind(value: string): value is FinancialFenceKind {
  return Object.hasOwn(financialBlockSchemas, value);
}

function validationCode(issue: z.core.$ZodIssue): FinancialBlockParseErrorCode {
  if (issue.code === "custom") {
    return (issue.params?.code as FinancialBlockParseErrorCode | undefined) ?? "invalid-field";
  }
  if (issue.code === "unrecognized_keys") return "unknown-field";
  if ((issue.code === "too_big" || issue.code === "too_small") && issue.origin === "array") {
    return "collection-limit";
  }
  if (issue.code === "invalid_format" && issue.format === "date") return "invalid-date";
  if (issue.code === "invalid_type" && issue.expected === "number") return "invalid-number";
  return "invalid-field";
}

export function parseFinancialBlock(
  kind: FinancialFenceKind,
  yamlSource: string,
): Result<FinancialBlockParseError, FinancialBlock> {
  let payload: Record<string, unknown>;
  try {
    const document = parseDocument(yamlSource, {
      schema: "core",
      customTags: [],
      resolveKnownTags: false,
      merge: false,
      stringKeys: true,
      prettyErrors: false,
      logLevel: "silent",
    });

    const diagnostics = [...document.errors, ...document.warnings];
    if (diagnostics.some(({ code }) => code === "TAG_RESOLVE_FAILED")) {
      return Result.fail(new FinancialBlockParseError(kind, "yaml-tag"));
    }

    let forbiddenCode: FinancialBlockParseErrorCode | undefined;
    visit(document, {
      Alias() {
        forbiddenCode = "yaml-alias";
        return visit.BREAK;
      },
      Value(_key, node) {
        if (node.tag && node.tag !== "!" && !document.schema.tags.some((tag) => tag.tag === node.tag)) {
          forbiddenCode = "yaml-tag";
          return visit.BREAK;
        }
      },
      Pair(_key, pair) {
        // Zod skips this key when checking for unexpected properties.
        if (isScalar(pair.key) && pair.key.value === "__proto__") {
          forbiddenCode = "unknown-field";
          return visit.BREAK;
        }
      },
    });
    if (forbiddenCode) {
      return Result.fail(new FinancialBlockParseError(kind, forbiddenCode));
    }
    if (diagnostics.length > 0) {
      return Result.fail(new FinancialBlockParseError(kind, "invalid-yaml"));
    }
    if (!isMap(document.contents)) {
      return Result.fail(new FinancialBlockParseError(kind, "invalid-field"));
    }
    payload = document.toJS({ maxAliasCount: 0 });
  } catch {
    return Result.fail(new FinancialBlockParseError(kind, "invalid-yaml"));
  }

  if (Object.hasOwn(payload, "kind")) {
    return Result.fail(new FinancialBlockParseError(kind, "unknown-field"));
  }
  if (Object.hasOwn(payload, "version") && payload.version !== 1) {
    return Result.fail(new FinancialBlockParseError(kind, "unsupported-version", ["version"]));
  }

  const parsed = financialBlockSchemas[kind].safeParse({ ...payload, kind, version: 1 });
  if (parsed.success) return Result.ok(parsed.data);

  const [issue] = parsed.error.issues;
  const path = issue.path.filter((part) => typeof part !== "symbol");
  return Result.fail(new FinancialBlockParseError(kind, validationCode(issue), path));
}
