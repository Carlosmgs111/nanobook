import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import type { NanobookRepositoryFailure } from "../domain/ports/NanobookRepository";
import type { CreateNanobookData } from "../domain/types";
import type {
  NanobookRootInitializer,
  NanobookCreationStore,
} from "./NanobookCreationTransaction";

export type CreateNanobookError = NanobookRepositoryFailure | Error;

export class CreateNanobook {
  constructor(
    private readonly creationStore: NanobookCreationStore,
    private readonly initializeRoot: NanobookRootInitializer,
  ) {}

  async execute(
    ownerId: string,
    input: Omit<CreateNanobookData, "id" | "ownerId"> & { id?: string },
  ): Promise<Result<CreateNanobookError, Nanobook>> {
    const result = Nanobook.create({
      ...input,
      id: input.id ?? crypto.randomUUID(),
      ownerId,
    });
    if (!result.isSuccess) return Result.fail(result.getError());

    const nanobook = result.getValue();
    const created = await this.creationStore.createWithRoot(
      nanobook,
      this.initializeRoot,
    );
    if (!created.isSuccess) return Result.fail(created.getError());
    return Result.ok(nanobook);
  }
}
