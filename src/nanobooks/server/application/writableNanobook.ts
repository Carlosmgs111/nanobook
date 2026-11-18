import { Subject, type Authorizer } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import { NanobookNotFoundError } from "../domain/errors";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import type { PersistedNanobook } from "../domain/types";

/**
 * Autoriza la escritura sobre un nanobook y lo carga.
 *
 * Regla de seguridad: se autoriza ANTES de cargar. Así un nanobook inexistente y uno
 * privado ajeno responden igual (deny not-found) y no se puede sondear su existencia.
 * Por eso `NanobookNotFoundError` solo aparece por una carrera: borrado entre la
 * autorización y la carga.
 */
export async function loadWritableNanobook(
  authorizer: Authorizer,
  repository: NanobookRepository,
  userId: string,
  id: string,
): Promise<Result<Error, Nanobook>> {
  const access = await authorizer.require({
    subject: Subject.of(userId),
    action: "write",
    resource: { type: "nanobook", id },
  });
  if (!access.isSuccess) return Result.fail(access.getError());

  const found = await repository.findById(id);
  if (!found.isSuccess) return Result.fail(found.getError());
  const book = found.getValue();
  if (!book) return Result.fail(new NanobookNotFoundError(id));
  return Result.ok(book);
}

/**
 * Reconstruye el agregado con los cambios, lo persiste y reemplaza su entrada de caché
 * (conservando el slug previo para invalidar la clave anterior).
 */
export async function saveNanobook(
  repository: NanobookRepository,
  cache: NanobookReadCache,
  current: Nanobook,
  changes: Partial<Omit<PersistedNanobook, "id" | "updatedAt">>,
): Promise<Result<Error, Nanobook>> {
  const updated = Nanobook.create({ ...current.toPersistence(), ...changes, updatedAt: new Date() });
  if (!updated.isSuccess) return Result.fail(updated.getError());
  const saved = await repository.update(updated.getValue());
  if (!saved.isSuccess) return Result.fail(saved.getError());
  await cache.replace(updated.getValue(), current.getSlug());
  return updated;
}
