import { z } from "zod";
import type { Authorizer } from "../../../authorization/server";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import { Result } from "../../../shared/domain/Result";
import { InvalidNanobookError } from "../domain/errors";
import { loadWritableNanobook, saveNanobook } from "./writableNanobook";
import {
  isThemeReference,
  type ThemeReference,
} from "../../../shared/theme/ThemeReference";

const inputSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).optional(),
    visibility: z.enum(["public", "private"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export class LifeCycle {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly cache: NanobookReadCache,
    private readonly authorizer: Authorizer
  ) {}

  delete = async (
    userId: string,
    id: string,
    confirmationName: unknown
  ): Promise<Result<Error, void>> => {
    const loaded = await loadWritableNanobook(
      this.authorizer,
      this.repository,
      userId,
      id
    );
    if (!loaded.isSuccess) return Result.fail(loaded.getError());
    const book = loaded.getValue();
    if (confirmationName !== book.getName()) {
      return Result.fail(
        new InvalidNanobookError(
          "Escribe el nombre exacto del nanobook para eliminarlo"
        )
      );
    }
    const deleted = await this.repository.delete(book);
    if (!deleted.isSuccess) return deleted;
    await this.cache.remove(book.getSlug());
    return deleted;
  };

  update = async (userId: string, id: string, input: unknown) => {
    const loaded = await loadWritableNanobook(
      this.authorizer,
      this.repository,
      userId,
      id
    );
    if (!loaded.isSuccess) return loaded;
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success)
      return Result.fail(
        new InvalidNanobookError("Indica nombre, slug o visibilidad válidos")
      );
    return saveNanobook(
      this.repository,
      this.cache,
      loaded.getValue(),
      parsed.data
    );
  };
  setNanobookTheme = async (
    userId: string,
    id: string,
    reference: ThemeReference
  ) => {
    if (!isThemeReference(reference))
      return Result.fail(new InvalidNanobookError("theme es inválido"));
    const loaded = await loadWritableNanobook(
      this.authorizer,
      this.repository,
      userId,
      id
    );
    if (!loaded.isSuccess) return Result.fail(loaded.getError());
    const current = loaded.getValue();
    return saveNanobook(this.repository, this.cache, current, {
      settings: { ...current.getSettings(), theme: reference },
    });
  };
}
