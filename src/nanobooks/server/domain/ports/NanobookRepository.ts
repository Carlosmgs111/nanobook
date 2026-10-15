import type { Result } from "../../../../shared/domain/Result";
import type { Nanobook } from "../Nanobook";
import type {
  NanobookRepositoryError,
  NanobookSlugAlreadyTakenError,
} from "../errors";
import type { NanobookSetupStatus } from "../types";

export type NanobookRepositoryFailure =
  | NanobookRepositoryError
  | NanobookSlugAlreadyTakenError;

export interface NanobookRepository {
  create(nanobook: Nanobook): Promise<Result<NanobookRepositoryFailure, void>>;
  findById(id: string): Promise<Result<NanobookRepositoryFailure, Nanobook | null>>;
  findBySlug(slug: string): Promise<Result<NanobookRepositoryFailure, Nanobook | null>>;
  listByOwner(ownerId: string): Promise<Result<NanobookRepositoryFailure, Nanobook[]>>;
  updateSetupStatus(
    id: string,
    status: NanobookSetupStatus,
  ): Promise<Result<NanobookRepositoryFailure, void>>;
}
