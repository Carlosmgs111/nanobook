import { z } from "zod";
import type { Authorizer } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import { InvalidNanobookError } from "../domain/errors";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { NanobookNotFoundError } from "./errors";
import type { NanobookReadCache } from "./NanobookReadCache";

const inputSchema = z.object({
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  visibility: z.enum(["public", "private"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export class UpdateNanobook {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly cache: NanobookReadCache,
    private readonly authorizer: Authorizer,
  ) {}

  async execute(userId: string, id: string, input: unknown): Promise<Result<Error, Nanobook>> {
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
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return Result.fail(new InvalidNanobookError("Indica nombre, slug o visibilidad válidos"));
    const updated = Nanobook.create({ ...book.toPersistence(), ...parsed.data, updatedAt: new Date() });
    if (!updated.isSuccess) return Result.fail(updated.getError());
    const saved = await this.repository.update(updated.getValue());
    if (!saved.isSuccess) return Result.fail(saved.getError());
    await this.cache.replace(updated.getValue(), book.getSlug());
    return updated;
  }
}
