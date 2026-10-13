import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import type {
  NanobookRepository,
  NanobookRepositoryFailure,
} from "../domain/ports/NanobookRepository";
import type { CreateNanobookData } from "../domain/types";

export type CreateNanobookError = NanobookRepositoryFailure | Error;
type CreateNanobookRepository = Pick<NanobookRepository, "create">;

export class CreateNanobook {
  constructor(private readonly repository: CreateNanobookRepository) {}

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

    const nanobook = result.getValue();
    const created = await this.repository.create(nanobook);
    if (!created.isSuccess) return Result.fail(created.getError());
    return Result.ok(nanobook);
  }
}
