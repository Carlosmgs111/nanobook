/**
 * Campos de frontmatter que gestiona el servidor. El editor no los muestra y,
 * si llegan en el texto editado, se descartan y se conserva el valor de la base.
 */
export const PROTECTED_FRONTMATTER_FIELDS = [
  "id",
  "author",
  "createdAt",
  "updatedAt",
  "ownerId",
  "secured",
] as const;
