import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import type { UpdateDocument } from "../../application/UpdateDocument";
import { DocumentNotFoundError } from "../../domain/errors";
import { UpdateDocumentController } from "./UpdateDocumentController";

describe("UpdateDocumentController", () => {
  it("uses the document id supplied by the nanobook route", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentNotFoundError("document-1")));
    const controller = new UpdateDocumentController({ execute } as unknown as UpdateDocument);

    const response = await controller.handle({
      params: { id: "document-1", nanobookId: "book-a" },
      request: new Request("https://nanobook.test/api/nanobooks/book-a/documents/document-1", {
        method: "PATCH",
        body: JSON.stringify({
          path: "guide",
          title: "Guide",
          description: "Description",
          content: "# Guide",
        }),
      }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(response.status).toBe(404);
    expect(execute).toHaveBeenCalledWith("book-a", expect.objectContaining({ id: "document-1" }), "owner-1");
  });
});
