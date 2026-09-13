export class InfrastructureError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "InfrastructureError";
    this.cause = options?.cause;
  }
}
