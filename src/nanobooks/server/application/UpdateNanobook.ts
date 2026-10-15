import { z } from "zod";
import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import { InvalidNanobookError } from "../domain/errors";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { AuthorizeNanobook, NanobookAccessDeniedError } from "./AuthorizeNanobook";
import { NanobookNotFoundError } from "./errors";

const inputSchema = z.object({
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  visibility: z.enum(["public", "private"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export class UpdateNanobook {
  constructor(private readonly repository: NanobookRepository) {}

  async execute(userId: string, id: string, input: unknown): Promise<Result<Error, Nanobook>> {
    const found = await this.repository.findById(id);
    if (!found.isSuccess) return Result.fail(found.getError());
    const book = found.getValue();
    if (!book) return Result.fail(new NanobookNotFoundError(id));
    if (!new AuthorizeNanobook().canWrite(book, userId)) {
      return Result.fail(new NanobookAccessDeniedError(id, "write"));
    }
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return Result.fail(new InvalidNanobookError("Indica nombre, slug o visibilidad válidos"));
    const updated = Nanobook.create({ ...book.toPersistence(), ...parsed.data, updatedAt: new Date() });
    if (!updated.isSuccess) return Result.fail(updated.getError());
    const saved = await this.repository.update(updated.getValue());
    if (!saved.isSuccess) return Result.fail(saved.getError());
    return updated;
  }
}
