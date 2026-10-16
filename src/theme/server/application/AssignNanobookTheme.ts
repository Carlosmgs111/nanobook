import { Result } from "../../../shared/domain/Result";
import type { ThemeReference } from "../../../shared/theme/ThemeReference";

interface AssignableThemes {
  execute(userId: string, reference: ThemeReference): Promise<Result<Error, ThemeReference>>;
}

interface NanobookThemeWriter {
  execute(
    userId: string,
    nanobookId: string,
    reference: ThemeReference,
  ): Promise<Result<Error, unknown>>;
}

export class AssignNanobookTheme {
  constructor(
    private readonly themes: AssignableThemes,
    private readonly nanobooks: NanobookThemeWriter,
  ) {}

  async execute(userId: string, nanobookId: string, reference: ThemeReference) {
    const assignable = await this.themes.execute(userId, reference);
    if (!assignable.isSuccess) return Result.fail(assignable.getError());
    return this.nanobooks.execute(userId, nanobookId, assignable.getValue());
  }
}
