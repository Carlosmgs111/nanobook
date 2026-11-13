import { z } from "zod";
import type { FinancialBlock, FinancialFenceKind } from "../model/FinancialBlock";
import { financialIssueMessage, financialIssuePath } from "../validation/financialIssueMessages";

/**
 * Esquema de props de una ficha financiera como bloque de componente.
 *
 * El autor no escribe `kind` (lo fija el nombre de la fence), así que se inyecta
 * antes de validar con el esquema estricto del bloque (`schema`); un `kind` escrito a mano
 * se ignora. Las incidencias se devuelven con su ruta y con el mensaje en español
 * del contrato, de modo que el validador y el aviso en línea siguen siendo claros.
 */
export function financialBlockProps<Kind extends FinancialFenceKind>(
  kind: Kind,
  schema: z.ZodType<Extract<FinancialBlock, { kind: Kind }>>,
): z.ZodType<Extract<FinancialBlock, { kind: Kind }>> {
  return z.any().transform((value, ctx) => {
    // `version` es opcional para el autor: sin ella rige la 1, como siempre.
    const payload =
      value !== null && typeof value === "object" && !Array.isArray(value) ? { version: 1, ...value, kind } : value;
    const result = schema.safeParse(payload);
    if (result.success) return result.data;

    for (const issue of result.error.issues) {
      ctx.addIssue({
        code: "custom",
        message: financialIssueMessage(issue),
        path: financialIssuePath(issue),
      });
    }
    return z.NEVER;
  }) as unknown as z.ZodType<Extract<FinancialBlock, { kind: Kind }>>;
}
