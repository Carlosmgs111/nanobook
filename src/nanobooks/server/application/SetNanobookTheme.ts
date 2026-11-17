import type { Authorizer } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import {
  isThemeReference,
  type ThemeReference,
} from "../../../shared/theme/ThemeReference";
import { InvalidNanobookError } from "../domain/errors";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import { loadWritableNanobook, saveNanobook } from "./writableNanobook";

export class SetNanobookTheme {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly cache: NanobookReadCache,
    private readonly authorizer: Authorizer,
  ) {}
  async execute(userId: string, id: string, reference: ThemeReference) {
    if (!isThemeReference(reference))
      return Result.fail(new InvalidNanobookError("theme es inválido"));
    const loaded = await loadWritableNanobook(this.authorizer, this.repository, userId, id);
    if (!loaded.isSuccess) return Result.fail(loaded.getError());
    const current = loaded.getValue();
    return saveNanobook(this.repository, this.cache, current, {
      settings: { ...current.getSettings(), theme: reference },
    });
  }
}
