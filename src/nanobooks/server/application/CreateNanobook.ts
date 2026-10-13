import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import type { NanobookRepositoryFailure } from "../domain/ports/NanobookRepository";
import type { CreateNanobookData } from "../domain/types";

export type CreateNanobookError = NanobookRepositoryFailure | Error;

export class CreateNanobook {
  constructor(private readonly repository: NanobookRepository) {}

  async execute(
    ownerId: string,
    input: Omit<CreateNanobookData, "id" | "ownerId"> & { id?: string },
  ): Promise<Result<CreateNanobookError, Nanobook>> {
    const result = Nanobook.create({
      ...input,
      id: input.id ?? crypto.randomUUID(),
      ownerId,
    });
    if (!result.isSuccess) return Result.fail(result.getError());

    const created = await this.repository.create(result.getValue());
    if (!created.isSuccess) return Result.fail(created.getError());
    return Result.ok(result.getValue());
  }
}
