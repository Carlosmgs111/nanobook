import { z } from "zod";
import type { Authorizer } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import type { Nanobook } from "../domain/Nanobook";
import { InvalidNanobookError } from "../domain/errors";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import { loadWritableNanobook, saveNanobook } from "./writableNanobook";

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
    const loaded = await loadWritableNanobook(this.authorizer, this.repository, userId, id);
    if (!loaded.isSuccess) return loaded;
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return Result.fail(new InvalidNanobookError("Indica nombre, slug o visibilidad válidos"));
    return saveNanobook(this.repository, this.cache, loaded.getValue(), parsed.data);
  }
}
