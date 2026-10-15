export type ColorModePreference = "light" | "dark" | "system";
export function normalizeColorModePreference(value: string | undefined): ColorModePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}
