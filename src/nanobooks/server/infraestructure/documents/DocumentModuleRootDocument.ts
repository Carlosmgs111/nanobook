import { Result } from "../../../../shared/domain/Result";
import type { DocumentModule } from "../../../../documents/server";
import type { Nanobook } from "../../domain/Nanobook";
import type { NanobookRootDocument } from "../../domain/ports/NanobookRootDocument";

export class DocumentModuleRootDocument implements NanobookRootDocument {
  constructor(private readonly documentModule: DocumentModule) {}

  async ensure(nanobook: Nanobook): Promise<Result<Error, void>> {
    try {
      const root = await this.documentModule.getDocument.executeRaw(
        nanobook.getId(),
        "index",
      );
      if (root) return Result.ok();

      const created = await this.documentModule.createDocument.execute(
        nanobook.getId(),
        {
          id: `root-${nanobook.getId()}`,
          path: "index",
          title: nanobook.getName(),
          description: nanobook.getName(),
          content: `# ${nanobook.getName()}\n`,
          author: nanobook.getOwnerId(),
        },
        nanobook.getOwnerId(),
      );
      if (!created.isSuccess) return Result.fail(created.getError());
      return Result.ok();
    } catch (error) {
      return Result.fail(toError(error));
    }
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
