import { Result } from "../../../shared/domain/Result";
import type { Nanobook } from "../domain/Nanobook";
import type {
  NanobookRepository,
  NanobookRepositoryFailure,
} from "../domain/ports/NanobookRepository";

export class GetNanobookBySlug {
  constructor(private readonly repository: NanobookRepository) {}

  async execute(
    slug: string,
  ): Promise<Result<NanobookRepositoryFailure, Nanobook | null>> {
    return this.repository.findBySlug(slug);
  }
}
