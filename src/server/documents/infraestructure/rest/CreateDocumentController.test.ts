import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import { DocumentAlreadyExistsError } from "../../domain/errors";
import type { CreateDocument } from "../../application/CreateDocument";
import { CreateDocumentController } from "./CreateDocumentController";

describe("CreateDocumentController", () => {
  it("assigns the authenticated actor as owner instead of trusting the request", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue(Result.fail(new DocumentAlreadyExistsError("new-doc")));
    const controller = new CreateDocumentController({ execute } as unknown as CreateDocument);

    await controller.handle({
      params: { slug: "new-doc" },
      request: new Request("https://nanobook.test/api/documents/new-doc", {
        method: "POST",
        body: JSON.stringify({
          id: "new-doc",
          path: "new-doc",
          title: "New document",
          description: "Created from UI",
          content: "# New document",
          ownerId: "forged-owner",
        }),
      }),
      locals: { currentUserId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv" },
    } as never);

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv",
      }),
    );
  });
});
