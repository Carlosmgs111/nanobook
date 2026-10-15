import { Result } from "../../../../shared/domain/Result";
import { Nanobook } from "../../domain/Nanobook";
import {
  NanobookRepositoryError,
  NanobookSlugAlreadyTakenError,
} from "../../domain/errors";
import type {
  NanobookRepository,
  NanobookRepositoryFailure,
} from "../../domain/ports/NanobookRepository";
import type { NanobookSetupStatus } from "../../domain/types";

/** Repositorio temporal para probar el flujo sin depender del esquema SQL. */
export class InMemoryNanobookRepository implements NanobookRepository {
  private readonly nanobooks = new Map<string, Nanobook>();

  constructor(nanobooks: Nanobook[] = []) {
    for (const nanobook of nanobooks) {
      this.nanobooks.set(nanobook.getId(), nanobook);
    }
  }

  async create(
    nanobook: Nanobook,
  ): Promise<Result<NanobookRepositoryFailure, void>> {
    const existing = await this.findBySlug(nanobook.getSlug());
    if (!existing.isSuccess) return Result.fail(existing.getError());
    if (existing.getValue()) {
      return Result.fail(new NanobookSlugAlreadyTakenError(nanobook.getSlug()));
    }
    if (this.nanobooks.has(nanobook.getId())) {
      return Result.fail(
        new NanobookRepositoryError(`El nanobook "${nanobook.getId()}" ya existe`),
      );
    }
    this.nanobooks.set(nanobook.getId(), nanobook);
    return Result.ok();
  }

  async findById(
    id: string,
  ): Promise<Result<NanobookRepositoryFailure, Nanobook | null>> {
    return Result.ok(this.nanobooks.get(id) ?? null);
  }

  async findBySlug(
    slug: string,
  ): Promise<Result<NanobookRepositoryFailure, Nanobook | null>> {
    const normalized = slug.trim().toLowerCase();
    return Result.ok(
      Array.from(this.nanobooks.values()).find(
        (nanobook) => nanobook.getSlug() === normalized,
      ) ?? null,
    );
  }

  async listByOwner(
    ownerId: string,
  ): Promise<Result<NanobookRepositoryFailure, Nanobook[]>> {
    return Result.ok(
      Array.from(this.nanobooks.values()).filter(
        (nanobook) => nanobook.getOwnerId() === ownerId,
      ),
    );
  }

  async updateSetupStatus(
    id: string,
    status: NanobookSetupStatus,
  ): Promise<Result<NanobookRepositoryFailure, void>> {
    const nanobook = this.nanobooks.get(id);
    if (!nanobook) {
      return Result.fail(
        new NanobookRepositoryError(`El nanobook "${id}" no existe`),
      );
    }
    this.nanobooks.set(id, nanobook.withSetupStatus(status));
    return Result.ok();
  }
}
