import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import type { NanobookRepositoryFailure } from "../domain/ports/NanobookRepository";
import type { CreateNanobookData } from "../domain/types";
import type {
  AtomicNanobookCreator,
  NanobookRootInitializer,
} from "./NanobookCreationTransaction";

export type CreateNanobookError = NanobookRepositoryFailure | Error;

export class CreateNanobook {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly initializeRoot?: NanobookRootInitializer,
    private readonly createAtomically?: AtomicNanobookCreator,
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
    const repositoryAtomicCreator = "createAtomically" in this.repository
      ? (this.repository as NanobookRepository & {
          createAtomically: AtomicNanobookCreator;
        }).createAtomically
      : undefined;
    const atomicCreator = this.createAtomically
      ?? (repositoryAtomicCreator
        ? repositoryAtomicCreator.bind(this.repository)
        : undefined);

    if (this.initializeRoot && atomicCreator) {
      const createdAtomically = await atomicCreator(nanobook, this.initializeRoot);
      if (!createdAtomically.isSuccess) {
        return Result.fail(createdAtomically.getError() as CreateNanobookError);
      }
      return Result.ok(nanobook);
    }

    const created = await this.repository.create(nanobook);
    if (!created.isSuccess) return Result.fail(created.getError());
    if (this.initializeRoot) await this.initializeRoot(nanobook);
    return Result.ok(nanobook);
  }
}
