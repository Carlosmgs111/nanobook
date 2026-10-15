import { Result } from "../../../shared/domain/Result";
import type { Theme } from "../domain/Theme";
import type { ThemeRepository } from "../domain/ports/ThemeRepository";
import { ThemeAccessDeniedError, ThemeNotFoundError } from "./errors";

export async function findOwned(repository: ThemeRepository, ownerId: string, id: string): Promise<Result<Error, Theme>> {
  const owned = await repository.findByOwner(ownerId, id);
  if (!owned.isSuccess) return Result.fail(owned.getError());
  if (owned.getValue()) return Result.ok(owned.getValue()!);
  const any = await repository.findById(id);
  if (!any.isSuccess) return Result.fail(any.getError());
  return Result.fail(any.getValue() ? new ThemeAccessDeniedError() : new ThemeNotFoundError());
}
