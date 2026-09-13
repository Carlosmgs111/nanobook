import { InfrastructureError } from "../../shared/errors";

export class PageCacheError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PageCacheError";
  }
}

export class PageRenderError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PageRenderError";
  }
}
