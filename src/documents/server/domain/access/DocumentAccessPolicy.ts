export type AccessDecision =
  | { kind: "allow" }
  | { kind: "challenge"; method: "password" };

export interface AccessEvaluationInput {
  secured: boolean;
  /** The viewer can write in the nanobook (owner). */
  canWrite: boolean;
  /** The viewer presented a currently valid grant for this document. */
  hasValidGrant: boolean;
}

/**
 * Decides whether a viewer may read a document. Password is the only method
 * today; profiles or levels can implement the same interface later.
 */
export interface DocumentAccessPolicy {
  evaluate(input: AccessEvaluationInput): AccessDecision;
}

export class PasswordAccessPolicy implements DocumentAccessPolicy {
  evaluate({ secured, canWrite, hasValidGrant }: AccessEvaluationInput): AccessDecision {
    if (!secured || canWrite || hasValidGrant) return { kind: "allow" };
    return { kind: "challenge", method: "password" };
  }
}
