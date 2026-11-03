const SIGNATURE_PARAMETER = "sig";
const SIGNED_PARAMETER_NAME = "ba_param";

/**
 * Keeps only the parameters covered by Better Auth's signed OAuth query.
 * Browser navigation helpers may append unrelated query parameters; forwarding
 * any of them invalidates the signature at the consent endpoint.
 */
export function getSignedOAuthQuery(search: string): string | undefined {
  const params = new URLSearchParams(search);
  if (!params.has(SIGNATURE_PARAMETER)) return undefined;

  const signedNames = new Set(params.getAll(SIGNED_PARAMETER_NAME));
  if (signedNames.size === 0) return undefined;

  const signedQuery = new URLSearchParams();
  for (const [name, value] of params) {
    if (
      name === SIGNATURE_PARAMETER
      || name === SIGNED_PARAMETER_NAME
      || signedNames.has(name)
    ) {
      signedQuery.append(name, value);
    }
  }

  return signedQuery.toString();
}
