import { Result } from "../../../shared/domain/Result";
import type { Nanobook } from "../domain/Nanobook";
import type {
  NanobookRepository,
  NanobookRepositoryFailure,
} from "../domain/ports/NanobookRepository";
import { NanobookNotFoundError } from "./errors";

export type GetNanobookByIdError =
  | NanobookRepositoryFailure
  | NanobookNotFoundError;

export class GetNanobookById {
  constructor(private readonly repository: NanobookRepository) {}

  async execute(
    nanobookId: string,
  ): Promise<Result<GetNanobookByIdError, Nanobook>> {
    const result = await this.repository.findById(nanobookId);
    if (!result.isSuccess) return Result.fail(result.getError());

    const nanobook = result.getValue();
    if (!nanobook) return Result.fail(new NanobookNotFoundError(nanobookId));

    return Result.ok(nanobook);
  }
}
