import { Result } from "../../../shared/domain/Result";
import { AccessCheckFailedError, AccessDeniedError } from "../domain/errors";
import type { AccessRequest, Authorize, Decision, Policy, ResolvedDecision } from "../domain/types";

export interface Authorizer {
  /** Lanza `AccessCheckFailedError` si una política falla por un error técnico. */
  authorize(request: AccessRequest): Promise<ResolvedDecision>;
  /** Como `authorize`, pero expresado como `Result`: solo `ok` cuando la decisión es `allow`. */
  require(request: AccessRequest): Promise<Result<AccessDeniedError | AccessCheckFailedError, void>>;
}

const DENY_REASONS: readonly string[] = ["unauthenticated", "forbidden", "not-found"];

/** Literal nuevo en cada llamada: un consumidor que mute la decisión no afecta a las siguientes. */
const forbidden = (): ResolvedDecision => ({ effect: "deny", reason: "forbidden" });

/** Motor de decisión. Conceder exige al menos un `allow` explícito y ningún `deny` ni `challenge`. */
export function createAuthorizer(policies: readonly Policy[]): Authorizer {
  const authorize: Authorize = async (request) => {
    let decisions: Decision[];
    try {
      const applicable = policies.filter((policy) => policy.appliesTo.includes(request.resource.type));
      decisions = await Promise.all(applicable.map((policy) => policy.evaluate(request, authorize)));
    } catch (cause) {
      throw cause instanceof AccessCheckFailedError ? cause : new AccessCheckFailedError(cause);
    }
    return combine(decisions);
  };

  return {
    authorize,
    async require(request) {
      try {
        const decision = await authorize(request);
        return decision.effect === "allow" ? Result.ok() : Result.fail(new AccessDeniedError(decision));
      } catch (error) {
        return Result.fail(
          error instanceof AccessCheckFailedError ? error : new AccessCheckFailedError(error),
        );
      }
    },
  };
}

function combine(decisions: readonly Decision[]): ResolvedDecision {
  let challenge: ResolvedDecision | undefined;
  let allowed = false;
  for (const decision of decisions) {
    switch (decision?.effect) {
      case "deny":
        // Un motivo desconocido se normaliza; nunca llega al borde un `reason` sin traducción.
        return DENY_REASONS.includes(decision.reason) ? { effect: "deny", reason: decision.reason } : forbidden();
      case "challenge":
        // Solo `password` es un reto válido; cualquier otro kind se trata como deny.
        if (decision.kind !== "password") return forbidden();
        challenge ??= { effect: "challenge", kind: "password" };
        break;
      case "allow":
        allowed = true;
        break;
      case "abstain":
        break;
      default:
        // Una decisión malformada nunca concede.
        return forbidden();
    }
  }
  return challenge ?? (allowed ? { effect: "allow" } : forbidden());
}
