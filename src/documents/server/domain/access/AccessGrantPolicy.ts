/** Tunable durability and abuse limits of document access grants. */
export interface AccessGrantPolicy {
  /** Absolute lifetime of a grant after a successful unlock. */
  readonly ttlSeconds: number;
  /** Failed attempts allowed per document and client within the window. */
  readonly maxFailures: number;
  readonly failureWindowSeconds: number;
}

export const DEFAULT_ACCESS_GRANT_POLICY: AccessGrantPolicy = Object.freeze({
  ttlSeconds: 12 * 60 * 60,
  maxFailures: 5,
  failureWindowSeconds: 15 * 60,
});
