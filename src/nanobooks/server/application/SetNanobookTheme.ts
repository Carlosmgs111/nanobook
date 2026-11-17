import type { Authorizer } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import {
  isThemeReference,
  type ThemeReference,
} from "../../../shared/theme/ThemeReference";
import { Nanobook } from "../domain/Nanobook";
import { InvalidNanobookError } from "../domain/errors";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { NanobookNotFoundError } from "./errors";
import type { NanobookReadCache } from "./NanobookReadCache";

export class SetNanobookTheme {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly cache: NanobookReadCache,
    private readonly authorizer: Authorizer,
  ) {}
  async execute(userId: string, id: string, reference: ThemeReference) {
    if (!isThemeReference(reference))
      return Result.fail(new InvalidNanobookError("theme es inválido"));
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
    const current = found.getValue();
    // Solo por una carrera: borrado entre la autorización y la carga.
    if (!current) return Result.fail(new NanobookNotFoundError(id));
    const updated = Nanobook.create({
      ...current.toPersistence(),
      settings: { ...current.getSettings(), theme: reference },
      updatedAt: new Date(),
    });
    if (!updated.isSuccess) return Result.fail(updated.getError());
    const saved = await this.repository.update(updated.getValue());
    if (!saved.isSuccess) return Result.fail(saved.getError());
    await this.cache.replace(updated.getValue(), current.getSlug());
    return updated;
  }
}
