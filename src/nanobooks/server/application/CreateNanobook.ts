import { Result } from "../../../shared/domain/Result";
import type { DocumentModule } from "../../../documents/server";
import { Nanobook } from "../domain/Nanobook";
import { NanobookSlugAlreadyTakenError } from "../domain/errors";
import type {
  NanobookRepository,
  NanobookRepositoryFailure,
} from "../domain/ports/NanobookRepository";
import type { CreateNanobookData } from "../domain/types";

export type CreateNanobookError = NanobookRepositoryFailure | Error;

export class CreateNanobook {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly documentModule: DocumentModule,
  ) {}

  async execute(
    ownerId: string,
    input: Omit<CreateNanobookData, "id" | "ownerId"> & { id?: string },
  ): Promise<Result<CreateNanobookError, Nanobook>> {
    const existingResult = await this.repository.findBySlug(input.slug);
    if (!existingResult.isSuccess) return Result.fail(existingResult.getError());

    let nanobook = existingResult.getValue();
    if (nanobook && nanobook.getOwnerId() !== ownerId) {
      return Result.fail(new NanobookSlugAlreadyTakenError(input.slug));
    }

    if (!nanobook) {
      const result = Nanobook.create({
        ...input,
        id: input.id ?? crypto.randomUUID(),
        ownerId,
        setupStatus: "pending",
      });
      if (!result.isSuccess) return Result.fail(result.getError());

      const created = await this.repository.create(result.getValue());
      if (!created.isSuccess) return Result.fail(created.getError());
      nanobook = result.getValue();
    }

    try {
      const root = await this.documentModule.getDocument.executeRaw(
        nanobook.getId(),
        "index",
      );
      if (!root) {
        const rootResult = await this.documentModule.createDocument.execute(
          nanobook.getId(),
          {
            id: `root-${nanobook.getId()}`,
            path: "index",
            title: nanobook.getName(),
            description: nanobook.getName(),
            content: `# ${nanobook.getName()}\n`,
            ownerId: nanobook.getOwnerId(),
            author: nanobook.getOwnerId(),
          },
        );
        if (!rootResult.isSuccess) {
          await this.updateSetupStatus(nanobook, "failed");
          return Result.fail(rootResult.getError());
        }
      }
    } catch (error) {
      await this.updateSetupStatus(nanobook, "failed");
      return Result.fail(toError(error));
    }

    const statusResult = await this.updateSetupStatus(nanobook, "ready");
    if (!statusResult.isSuccess) return Result.fail(statusResult.getError());
    return Result.ok(nanobook.withSetupStatus("ready"));
  }

  private async updateSetupStatus(
    nanobook: Nanobook,
    status: "ready" | "failed",
  ): Promise<Result<NanobookRepositoryFailure, void>> {
    const result = await this.repository.updateSetupStatus(
      nanobook.getId(),
      status,
    );
    if (!result.isSuccess) return Result.fail(result.getError());
    return Result.ok();
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
