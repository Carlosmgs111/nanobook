/**
 * Find the index of the closest section whose offset is less than or equal to
 * the current scroll position plus an optional viewport offset.
 *
 * This is a generic binary-search helper useful for scroll-spy components such
 * as table-of-contents, reading-progress indicators, dynamic breadcrumbs, etc.
 *
 * @param scrollY - Current vertical scroll position in pixels.
 * @param offsets - Sorted array of element offsets (e.g. heading offsetTop values).
 * @param offset - Optional viewport offset to apply before comparing.
 * @returns The index of the active section. Defaults to 0 if no section matches.
 */
export function findActiveIndex(
  scrollY: number,
  offsets: number[],
  offset: number = 120
): number {
  if (offsets.length === 0) return 0;

  const target = scrollY + offset;
  let left = 0;
  let right = offsets.length - 1;
  let result = 0;

  while (left <= right) {
    const mid = (left + right) >>> 1;
    if (offsets[mid] <= target) {
      result = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
}
