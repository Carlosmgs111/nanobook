import { ResolveTheme } from "./application/ResolveTheme";
import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import type { RouteProtector } from "../../shared/server/capabilities/RouteProtector";
import { CreateTheme } from "./application/CreateTheme";
import { UpdateTheme } from "./application/UpdateTheme";
import { ListThemes } from "./application/ListThemes";
import { GetTheme } from "./application/GetTheme";
import { GetAssignableTheme } from "./application/GetAssignableTheme";
import { OfficialThemeCatalog } from "./infraestructure/OfficialThemeCatalog";
import { DrizzleThemeRepository } from "./infraestructure/repository/DrizzleThemeRepository";
import { ThemeCollectionController } from "./infraestructure/rest/ThemeCollectionController";
import { ThemeItemController } from "./infraestructure/rest/ThemeItemController";
import { AssignNanobookTheme } from "./application/AssignNanobookTheme";
import { AssignNanobookThemeController } from "./infraestructure/rest/AssignNanobookThemeController";
import type { Result } from "../../shared/domain/Result";
import type { ThemeReference } from "../../shared/theme/ThemeReference";

interface NanobookThemeWriter {
  execute(userId: string, nanobookId: string, reference: ThemeReference): Promise<Result<Error, unknown>>;
}

export type { AppliedTheme, ThemeReference } from "./application/ResolveTheme";
export { normalizeColorModePreference } from "./application/ColorModePreference";

export class ThemeModule {
  private constructor(
    public readonly resolveTheme: ResolveTheme,
    public readonly getAssignableTheme: GetAssignableTheme,
    public readonly createTheme: CreateTheme,
    public readonly updateTheme: UpdateTheme,
    public readonly listThemes: ListThemes,
    public readonly getTheme: GetTheme,
    public readonly collectionRoutes: { GET: ReturnType<RouteProtector["protect"]>; POST: ReturnType<RouteProtector["protect"]> },
    public readonly itemRoutes: { GET: ReturnType<RouteProtector["protect"]>; PATCH: ReturnType<RouteProtector["protect"]> },
    public readonly assignNanobookThemeRoute: ReturnType<RouteProtector["protect"]>,
  ) {}

  static create(routeProtector: RouteProtector, nanobookThemeWriter: NanobookThemeWriter): ThemeModule {
    const repository = new DrizzleThemeRepository(db);
    const createTheme = new CreateTheme(repository);
    const updateTheme = new UpdateTheme(repository);
    const listThemes = new ListThemes(repository);
    const getTheme = new GetTheme(repository);
    const getAssignableTheme = new GetAssignableTheme(repository);
    const collection = new ThemeCollectionController(listThemes, createTheme);
    const item = new ThemeItemController(getTheme, updateTheme);
    const assign = new AssignNanobookTheme(getAssignableTheme, nanobookThemeWriter);
    const assignController = new AssignNanobookThemeController(assign);
    return new ThemeModule(
      new ResolveTheme(new OfficialThemeCatalog(), repository),
      getAssignableTheme, createTheme, updateTheme, listThemes, getTheme,
      { GET: routeProtector.protect(collection.get), POST: routeProtector.protect(collection.post) },
      { GET: routeProtector.protect(item.get), PATCH: routeProtector.protect(item.patch) },
      routeProtector.protect(assignController.handle),
    );
  }
}
