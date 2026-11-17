import type { Authorizer } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import { InvalidNanobookError } from "../domain/errors";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { NanobookNotFoundError } from "./errors";
import type { NanobookReadCache } from "./NanobookReadCache";

export class DeleteNanobook {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly cache: NanobookReadCache,
    private readonly authorizer: Authorizer,
  ) {}

  async execute(userId: string, id: string, confirmationName: unknown): Promise<Result<Error, void>> {
    // Primero se autoriza y después se carga: así un nanobook inexistente y uno privado ajeno
    // responden igual (deny not-found) y no se puede sondear su existencia.
    const access = await this.authorizer.require({
      subject: { userId: async () => userId, grantFor: () => undefined },
      action: "write",
      resource: { type: "nanobook", id },
    });
    if (!access.isSuccess) return Result.fail(access.getError());

    const found = await this.repository.findById(id);
    if (!found.isSuccess) return Result.fail(found.getError());
    const book = found.getValue();
    // Solo por una carrera: borrado entre la autorización y la carga.
    if (!book) return Result.fail(new NanobookNotFoundError(id));
    if (confirmationName !== book.getName()) {
      return Result.fail(new InvalidNanobookError("Escribe el nombre exacto del nanobook para eliminarlo"));
    }
    const deleted = await this.repository.delete(book);
    if (!deleted.isSuccess) return deleted;
    await this.cache.remove(book.getSlug());
    return deleted;
  }
}
