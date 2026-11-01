import { Result } from "../../../shared/domain/Result";
import {
  isThemeReference,
  type ThemeReference,
} from "../../../shared/theme/ThemeReference";
import { Nanobook } from "../domain/Nanobook";
import { InvalidNanobookError } from "../domain/errors";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import {
  AuthorizeNanobook,
  NanobookAccessDeniedError,
} from "./AuthorizeNanobook";
import { NanobookNotFoundError } from "./errors";
import type { NanobookReadCache } from "./NanobookReadCache";

export class SetNanobookTheme {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly cache: NanobookReadCache,
  ) {}
  async execute(userId: string, id: string, reference: ThemeReference) {
    if (!isThemeReference(reference))
      return Result.fail(new InvalidNanobookError("theme es inválido"));
    const found = await this.repository.findById(id);
    if (!found.isSuccess) return Result.fail(found.getError());
    const current = found.getValue();
    if (!current) return Result.fail(new NanobookNotFoundError(id));
    if (!new AuthorizeNanobook().canWrite(current, userId))
      return Result.fail(new NanobookAccessDeniedError(id, "write"));
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
