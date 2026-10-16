export type ColorModePreference = "light" | "dark";
export function normalizeColorModePreference(
  value: string | undefined
): ColorModePreference {
  return value === "light" || value === "dark"
    ? value
    : "light";
}
