export class AgentScopeDeniedError extends Error {
  constructor(public readonly requiredScope: "nanobooks:read" | "nanobooks:write") {
    super(`El token no incluye el scope ${requiredScope}`);
    this.name = "AgentScopeDeniedError";
  }
}
