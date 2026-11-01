import { Result } from "../../../shared/domain/Result";
import type { Nanobook } from "../domain/Nanobook";
import type {
  NanobookRepository,
  NanobookRepositoryFailure,
} from "../domain/ports/NanobookRepository";
import type { NanobookReadCache } from "./NanobookReadCache";

export class GetNanobookBySlug {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly cache: NanobookReadCache,
  ) {}

  async execute(
    slug: string,
  ): Promise<Result<NanobookRepositoryFailure, Nanobook | null>> {
    return this.cache.getOrLoad(slug, () => this.repository.findBySlug(slug));
  }
}
