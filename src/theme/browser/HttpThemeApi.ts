import type { OfficialThemeId } from "../server/infraestructure/OfficialThemeCatalog";

export interface ThemePaletteDto {
  pageBackground?: string;
  surfaceBackground?: string;
  text?: string;
  textMuted?: string;
  accent?: string;
  border?: string;
  borderSubtle?: string;
  accentText?: string;
  statusError?: string;
  statusWarning?: string;
  statusSuccess?: string;
  statusInfo?: string;
  link?: string;
  focusRing?: string;
  selectionBg?: string;
  selectionText?: string;
  surfaceRaised?: string;
}
export interface ThemeTokensDto {
  light?: ThemePaletteDto;
  dark?: ThemePaletteDto;
  typography?: {
    family?: "system-sans" | "editorial-serif" | "mono";
    heading?: "system-sans" | "editorial-serif" | "mono";
    code?: "system-sans" | "editorial-serif" | "mono";
    scale?: "small" | "normal" | "large";
    rhythm?: "compact" | "balanced" | "airy";
  };
  shape?: {
    radius?: "square" | "soft" | "rounded";
    cover?: "book" | "square" | "rounded";
  };
  layout?: { density?: "compact" | "comfortable" | "relaxed"; readingMeasure?: "narrow" | "standard" | "wide" | "full" };
  decoration?: {
    pattern?: "none" | "grid" | "texture" | "stripes" | "hatch";
    patternScale?: "fine" | "regular" | "coarse";
    patternContrast?: "subtle" | "balanced" | "strong";
    corners?: "none" | "cross" | "line";
    shadow?: "flat" | "offset" | "soft";
  };
}
export interface ThemeSummaryDto {
  reference: { kind: "official" | "custom"; id: string };
  name: string;
  baseThemeId: OfficialThemeId;
  editable: boolean;
}
export interface ThemeDetailsDto extends ThemeSummaryDto {
  tokens: ThemeTokensDto;
}
export interface CreateThemeInput {
  name: string;
  baseThemeId: OfficialThemeId;
  tokens?: ThemeTokensDto;
}
export interface UpdateThemeInput {
  name?: string;
  tokens?: ThemeTokensDto;
}

export class HttpThemeApi {
  list() {
    return this.request<ThemeSummaryDto[]>("/api/themes", { method: "GET" });
  }
  get(id: string) {
    return this.request<ThemeDetailsDto>(
      `/api/themes/${encodeURIComponent(id)}`,
      { method: "GET" }
    );
  }
  create(input: CreateThemeInput) {
    return this.request<ThemeDetailsDto>(
      "/api/themes",
      jsonRequest("POST", input)
    );
  }
  update(id: string, input: UpdateThemeInput) {
    return this.request<ThemeDetailsDto>(
      `/api/themes/${encodeURIComponent(id)}`,
      jsonRequest("PATCH", input)
    );
  }
  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await globalThis.fetch(url, init);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        typeof payload?.error === "string"
          ? payload.error
          : "No fue posible completar la operación"
      );
    return payload as T;
  }
}

function jsonRequest(method: "POST" | "PATCH", value: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}
