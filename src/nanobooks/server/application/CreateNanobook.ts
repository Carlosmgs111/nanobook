import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import { NanobookSlugAlreadyTakenError } from "../domain/errors";
import type {
  NanobookRepository,
  NanobookRepositoryFailure,
} from "../domain/ports/NanobookRepository";
import type { CreateNanobookData } from "../domain/types";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import type { NanobookRootDocument } from "../domain/ports/NanobookRootDocument";

export type CreateNanobookError = NanobookRepositoryFailure | Error;

type CreateNanobookInput = Omit<CreateNanobookData, "id" | "ownerId"> & {
  id?: string;
};

export class CreateNanobook {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly rootDocument: NanobookRootDocument,
    private readonly cache: NanobookReadCache,
  ) {}

  async execute(
    ownerId: string,
    input: CreateNanobookInput,
  ): Promise<Result<CreateNanobookError, Nanobook>> {
    const found = await this.findOrCreate(ownerId, input);
    if (!found.isSuccess) return Result.fail(found.getError());
    const nanobook = found.getValue();

    const provisioned = await this.provisionRootDocument(nanobook);
    if (!provisioned.isSuccess) return Result.fail(provisioned.getError());

    return this.markReady(nanobook);
  }

  private async findOrCreate(
    ownerId: string,
    input: CreateNanobookInput,
  ): Promise<Result<CreateNanobookError, Nanobook>> {
    const existingResult = await this.repository.findBySlug(input.slug);
    if (!existingResult.isSuccess) return Result.fail(existingResult.getError());

    const existing = existingResult.getValue();
    if (existing) {
      if (existing.getOwnerId() !== ownerId) {
        return Result.fail(new NanobookSlugAlreadyTakenError(input.slug));
      }
      return Result.ok(existing);
    }

    const result = Nanobook.create({
      ...input,
      id: input.id ?? crypto.randomUUID(),
      ownerId,
      settings: input.settings ?? { theme: { kind: "official", id: "monocromo" } },
      setupStatus: "pending",
    });
    if (!result.isSuccess) return Result.fail(result.getError());

    const created = await this.repository.create(result.getValue());
    if (!created.isSuccess) return Result.fail(created.getError());
    return Result.ok(result.getValue());
  }

  private async provisionRootDocument(
    nanobook: Nanobook,
  ): Promise<Result<CreateNanobookError, void>> {
    const ensured = await this.rootDocument.ensure(nanobook);
    if (ensured.isSuccess) return Result.ok();

    await this.updateSetupStatus(nanobook, "failed");
    return Result.fail(ensured.getError());
  }

  private async markReady(
    nanobook: Nanobook,
  ): Promise<Result<CreateNanobookError, Nanobook>> {
    const statusResult = await this.updateSetupStatus(nanobook, "ready");
    if (!statusResult.isSuccess) return Result.fail(statusResult.getError());

    const readyNanobook = nanobook.withSetupStatus("ready");
    await this.cache.replace(readyNanobook);
    return Result.ok(readyNanobook);
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
