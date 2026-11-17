import type { Authorizer } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import { InvalidNanobookError } from "../domain/errors";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import { loadWritableNanobook } from "./writableNanobook";

export class DeleteNanobook {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly cache: NanobookReadCache,
    private readonly authorizer: Authorizer,
  ) {}

  async execute(userId: string, id: string, confirmationName: unknown): Promise<Result<Error, void>> {
    const loaded = await loadWritableNanobook(this.authorizer, this.repository, userId, id);
    if (!loaded.isSuccess) return Result.fail(loaded.getError());
    const book = loaded.getValue();
    if (confirmationName !== book.getName()) {
      return Result.fail(new InvalidNanobookError("Escribe el nombre exacto del nanobook para eliminarlo"));
    }
    const deleted = await this.repository.delete(book);
    if (!deleted.isSuccess) return deleted;
    await this.cache.remove(book.getSlug());
    return deleted;
  }
}
