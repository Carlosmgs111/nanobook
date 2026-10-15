export type ThemeReference =
  | { kind: "official"; id: "classic" | "nanobook" }
  | { kind: "custom"; id: string };

export function isThemeReference(value: unknown): value is ThemeReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const reference = value as Record<string, unknown>;
  if (Object.keys(reference).some((key) => key !== "kind" && key !== "id")) return false;
  if (reference.kind === "official") return reference.id === "classic" || reference.id === "nanobook";
  return reference.kind === "custom" && typeof reference.id === "string" && reference.id.trim().length > 0;
}
