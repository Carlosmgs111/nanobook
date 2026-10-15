export interface ThemePaletteDto {
  pageBackground?: string; surfaceBackground?: string; text?: string;
  textMuted?: string; accent?: string; border?: string;
}
export interface ThemeTokensDto {
  light?: ThemePaletteDto; dark?: ThemePaletteDto;
  typography?: { family?: "system-sans" | "editorial-serif" | "mono" };
  shape?: { radius?: "square" | "soft" | "rounded" };
  layout?: { density?: "compact" | "comfortable" | "relaxed" };
  decoration?: { pattern?: "none" | "grid" | "hatch" };
}
export interface ThemeSummaryDto {
  reference: { kind: "official" | "custom"; id: string };
  name: string; baseThemeId: "classic" | "nanobook"; editable: boolean;
}
export interface ThemeDetailsDto extends ThemeSummaryDto { tokens: ThemeTokensDto; }
export interface CreateThemeInput { name: string; baseThemeId: "classic" | "nanobook"; tokens?: ThemeTokensDto; }
export interface UpdateThemeInput { name?: string; tokens?: ThemeTokensDto; }

export class HttpThemeApi {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  list() { return this.request<ThemeSummaryDto[]>("/api/themes", { method: "GET" }); }
  get(id: string) { return this.request<ThemeDetailsDto>(`/api/themes/${encodeURIComponent(id)}`, { method: "GET" }); }
  create(input: CreateThemeInput) { return this.request<ThemeDetailsDto>("/api/themes", jsonRequest("POST", input)); }
  update(id: string, input: UpdateThemeInput) { return this.request<ThemeDetailsDto>(`/api/themes/${encodeURIComponent(id)}`, jsonRequest("PATCH", input)); }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await this.fetcher(url, init);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "No fue posible completar la operación");
    return payload as T;
  }
}

function jsonRequest(method: "POST" | "PATCH", value: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) };
}
