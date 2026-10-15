import { Result } from "../../../shared/domain/Result";
import type { ThemeRepository } from "../domain/ports/ThemeRepository";
import { toThemeDetails, type ThemeSummary } from "./dto/ThemeDtos";

const official: ThemeSummary[] = [
  { reference: { kind: "official", id: "classic" }, name: "Clásico", baseThemeId: "classic", editable: false },
  { reference: { kind: "official", id: "nanobook" }, name: "Nanobook", baseThemeId: "nanobook", editable: false },
];
export class ListThemes {
  constructor(private readonly repository: ThemeRepository) {}
  async execute(ownerId: string): Promise<Result<Error, ThemeSummary[]>> {
    const listed = await this.repository.listByOwner(ownerId);
    return listed.isSuccess ? Result.ok([...official, ...listed.getValue().map(toThemeDetails)]) : Result.fail(listed.getError());
  }
}
