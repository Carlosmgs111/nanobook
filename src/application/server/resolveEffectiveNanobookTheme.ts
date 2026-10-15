import type { Nanobook } from "../../nanobooks/server";
import type { AppliedTheme } from "../../theme/server";
import type { ThemeReference } from "../../shared/theme/ThemeReference";

interface ThemeResolver { execute(reference: ThemeReference, request?: Request): Promise<AppliedTheme>; }

export function resolveEffectiveNanobookTheme(nanobook: Nanobook, resolver: ThemeResolver, request?: Request) {
  const reference = nanobook.getSettings().theme ?? { kind: "official", id: "classic" } as const;
  return resolver.execute(reference, request);
}
