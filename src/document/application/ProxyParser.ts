import type { DocumentMetadata } from "../domain/types";
import { Document } from "../domain/Document";
import type { ReferenceResolver } from "../domain/reference/types";
import { DocumentReference } from "../domain/DocumentReference";

export class ProxyParser {
  constructor(private resolver: ReferenceResolver) {}

  parseProxy = async (
    sourceDocument: Document,
  ): Promise<Document | null> => {
    const data = sourceDocument.getMetadata();
    if (!data.ref) return null;

    const ref = new DocumentReference(data.ref);

    try {
      const targetEntry = await this.resolver.resolve(ref, sourceDocument);

      if (!targetEntry) {
        console.warn(
          `Proxy reference not found: ${sourceDocument
            .getId()
            .getValue()} -> ${JSON.stringify(data.ref)}`
        );
        return null;
      }

      const targetData = targetEntry.data as DocumentMetadata;

      if (targetData.ref) {
        console.warn(
          `Chained proxy references are not supported: ${sourceDocument
            .getId()
            .getValue()} -> ${JSON.stringify(data.ref)}`
        );
        return null;
      }

      const mergedData: DocumentMetadata = {
        ...data,
        ...targetData,
        position: data.position,
        index: data.index,
        ref: undefined,
      };
      const proxyDocumentResult = Document.create(
        sourceDocument.getId().getValue(),
        mergedData,
        targetEntry.body
      );
      if (!proxyDocumentResult.isSuccess) {
        console.warn(
          `Failed to create proxy document ${sourceDocument
            .getId()
            .getValue()}: ${proxyDocumentResult.getError().message}`
        );
        return null;
      }
      return proxyDocumentResult.getValue();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Failed to resolve proxy ${sourceDocument
          .getId()
          .getValue()}: ${message}`
      );
      return null;
    }
  };

  parseProxies = async (documents: Document[]): Promise<Document[]> => {
    return Promise.all(
      documents.map(async (document) => {
        if (!document.getMetadata().ref) return document;
        return (await this.parseProxy(document)) ?? document;
      })
    );
  };
}
