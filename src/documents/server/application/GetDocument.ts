import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { ProxyParser } from "./ProxyParser";
import { DocumentPath } from "../domain/DocumentPath";
import type { DocumentSourceCache } from "./DocumentSourceCache";

export type DocumentTimingObserver = (
  name: "document-lookup" | "document-proxy",
  duration: number,
) => void;

export class GetDocument {
  constructor(
    private contentRepository: ContentRepository,
    private parseProxy: ProxyParser,
    private readonly sourceCache: DocumentSourceCache,
  ) {}

  async execute(
    nanobookId: string,
    documentPathValue: string,
    observeTiming?: DocumentTimingObserver,
  ): Promise<Document | null> {
    const document = await measure("document-lookup", observeTiming, () =>
      this.executeRaw(nanobookId, documentPathValue),
    );
    if (!document) return null;
    return (
      await measure("document-proxy", observeTiming, () =>
        this.parseProxy.parseProxies(nanobookId, [document]),
      )
    )[0];
  }

  async executeRaw(nanobookId: string, documentPathValue: string): Promise<Document | null> {
    const pathResult = DocumentPath.create(documentPathValue);
    if (!pathResult.isSuccess) return null;

    const publicPath = pathResult.getValue().getPublicValue();
    const documentResult = await this.sourceCache.getOrLoad(
      nanobookId,
      publicPath,
      () => this.contentRepository.getByPublicPath(nanobookId, publicPath),
    );
    if (!documentResult.isSuccess) {
      return null;
    }

    const document = documentResult.getValue();
    if (!document) return null;
    return document;
  }
}

async function measure<T>(
  name: "document-lookup" | "document-proxy",
  observeTiming: DocumentTimingObserver | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    observeTiming?.(name, performance.now() - startedAt);
  }
}
