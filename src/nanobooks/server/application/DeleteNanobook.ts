import { Result } from "../../../shared/domain/Result";
import { InvalidNanobookError } from "../domain/errors";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { AuthorizeNanobook, NanobookAccessDeniedError } from "./AuthorizeNanobook";
import { NanobookNotFoundError } from "./errors";
import type { NanobookReadCache } from "./NanobookReadCache";

export class DeleteNanobook {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly cache: NanobookReadCache,
  ) {}

  async execute(userId: string, id: string, confirmationName: unknown): Promise<Result<Error, void>> {
    const found = await this.repository.findById(id);
    if (!found.isSuccess) return Result.fail(found.getError());
    const book = found.getValue();
    if (!book) return Result.fail(new NanobookNotFoundError(id));
    if (!new AuthorizeNanobook().canWrite(book, userId)) {
      return Result.fail(new NanobookAccessDeniedError(id, "write"));
    }
    if (confirmationName !== book.getName()) {
      return Result.fail(new InvalidNanobookError("Escribe el nombre exacto del nanobook para eliminarlo"));
    }
    const deleted = await this.repository.delete(book);
    if (!deleted.isSuccess) return deleted;
    await this.cache.remove(book.getSlug());
    return deleted;
  }
}
