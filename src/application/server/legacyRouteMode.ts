export function shouldUseNanobookSqlCutover(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.NANOBOOK_SQL_CUTOVER?.trim().toLowerCase() === "true";
}
