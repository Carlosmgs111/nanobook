export function formatServerTiming(timings: Record<string, number>): string {
  return Object.entries(timings)
    .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
    .join(", ");
}

export function appendServerTiming(
  existing: string | null,
  timings: Record<string, number>,
): string {
  return [existing, formatServerTiming(timings)].filter(Boolean).join(", ");
}
