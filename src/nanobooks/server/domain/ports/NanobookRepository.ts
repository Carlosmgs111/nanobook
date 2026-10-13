import type { Result } from "../../../../shared/domain/Result";
import type { Nanobook } from "../Nanobook";
import type {
  NanobookRepositoryError,
  NanobookSlugAlreadyTakenError,
} from "../errors";

export type NanobookRepositoryFailure =
  | NanobookRepositoryError
  | NanobookSlugAlreadyTakenError;

export interface NanobookRepository {
  findById(id: string): Promise<Result<NanobookRepositoryFailure, Nanobook | null>>;
  findBySlug(slug: string): Promise<Result<NanobookRepositoryFailure, Nanobook | null>>;
  listByOwner(ownerId: string): Promise<Result<NanobookRepositoryFailure, Nanobook[]>>;
}
