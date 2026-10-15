import { Result } from "../../../shared/domain/Result";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";

export interface PublicNanobook { name: string; slug: string }

export class ListPublicNanobooks {
  constructor(private readonly repository: Pick<NanobookRepository, "listPublic">) {}

  async execute() {
    const result = await this.repository.listPublic();
    if (!result.isSuccess) return Result.fail(result.getError());
    return Result.ok<PublicNanobook[]>(result.getValue().map(book => ({
      name: book.getName(), slug: book.getSlug(),
    })));
  }
}
