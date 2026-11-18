import { Result } from "../../../shared/domain/Result";
import type { Nanobook } from "../domain/Nanobook";
import type {
  NanobookRepository,
  NanobookRepositoryFailure,
} from "../domain/ports/NanobookRepository";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import { NanobookNotFoundError } from "../domain/errors";

export interface PublicNanobook {
  name: string;
  slug: string;
}

export class Reading {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly cache: NanobookReadCache
  ) {}
  listPublicNanobooks = async () => {
    const result = await this.repository.listPublic();
    if (!result.isSuccess) return Result.fail(result.getError());
    return Result.ok<PublicNanobook[]>(
      result.getValue().map((book) => ({
        name: book.getName(),
        slug: book.getSlug(),
      }))
    );
  };
  listNanobooks = (ownerId: string) => {
    return this.repository.listByOwner(ownerId);
  };
  getNanobookById = async (
    id: string
  ): Promise<
    Result<NanobookRepositoryFailure | NanobookNotFoundError, Nanobook>
  > => {
    const found = await this.repository.findById(id);
    if (!found.isSuccess) return Result.fail(found.getError());
    const nanobook = found.getValue();
    return nanobook
      ? Result.ok(nanobook)
      : Result.fail(new NanobookNotFoundError(id));
  };
  getNanobookBySlug = async (
    slug: string
  ): Promise<Result<NanobookRepositoryFailure, Nanobook | null>> => {
    return this.cache.getOrLoad(slug, () => this.repository.findBySlug(slug));
  };
}
