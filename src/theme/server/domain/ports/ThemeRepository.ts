import type { Result } from "../../../../shared/domain/Result";
import type { Theme } from "../Theme";
import type { ThemeRepositoryError } from "../errors";

export interface ThemeRepository {
  create(theme: Theme): Promise<Result<ThemeRepositoryError, void>>;
  update(theme: Theme): Promise<Result<ThemeRepositoryError, void>>;
  findById(id: string): Promise<Result<ThemeRepositoryError, Theme | null>>;
  findByOwner(ownerId: string, id: string): Promise<Result<ThemeRepositoryError, Theme | null>>;
  listByOwner(ownerId: string): Promise<Result<ThemeRepositoryError, Theme[]>>;
}
