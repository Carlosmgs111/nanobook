import { Result } from "../../../../shared/domain/Result";
import type { Theme } from "../../domain/Theme";
import { ThemeRepositoryError } from "../../domain/errors";
import type { ThemeRepository } from "../../domain/ports/ThemeRepository";

export class InMemoryThemeRepository implements ThemeRepository {
  private readonly themes = new Map<string, Theme>();

  constructor(themes: Theme[] = []) {
    themes.forEach((theme) => this.themes.set(theme.getId(), theme));
  }

  async create(theme: Theme) {
    if (this.themes.has(theme.getId())) return Result.fail(new ThemeRepositoryError("El tema ya existe"));
    this.themes.set(theme.getId(), theme);
    return Result.ok();
  }

  async update(theme: Theme) {
    const current = this.themes.get(theme.getId());
    if (!current || current.getOwnerId() !== theme.getOwnerId()) return Result.fail(new ThemeRepositoryError("El tema no existe"));
    this.themes.set(theme.getId(), theme);
    return Result.ok();
  }

  async findById(id: string) { return Result.ok(this.themes.get(id) ?? null); }
  async findByOwner(ownerId: string, id: string) {
    const theme = this.themes.get(id);
    return Result.ok(theme?.getOwnerId() === ownerId ? theme : null);
  }
  async listByOwner(ownerId: string) {
    return Result.ok([...this.themes.values()].filter((theme) => theme.getOwnerId() === ownerId));
  }
}
