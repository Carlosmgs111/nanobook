import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import type { DeleteDocument } from "../../application/DeleteDocument";
import { DocumentNotFoundError } from "../../domain/errors";
import { DeleteDocumentController } from "./DeleteDocumentController";

describe("DeleteDocumentController", () => {
  it("uses the document id supplied by the nanobook route", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentNotFoundError("document-1")));
    const controller = new DeleteDocumentController({ execute } as unknown as DeleteDocument);

    const response = await controller.handle({
      params: { id: "document-1", nanobookId: "book-a" },
      request: new Request("https://nanobook.test/api/nanobooks/book-a/documents/document-1", {
        method: "DELETE",
      }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(response.status).toBe(404);
    expect(execute).toHaveBeenCalledWith("book-a", "document-1", "owner-1");
  });
});
