import type { NanobookRepository } from "../domain/ports/NanobookRepository";

export class ListNanobooks {
  constructor(private readonly repository: NanobookRepository) {}

  execute(ownerId: string) {
    return this.repository.listByOwner(ownerId);
  }
}
