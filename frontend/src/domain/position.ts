// Sparse-gap ordering math. Runs identically in both storage modes; the
// backend mirrors these semantics (contract parity).

export const GAP = 1024
export const MIN_GAP = 2

/** Position for a task appended at the end of the list. First task = 1024. */
export function appendPosition(positions: number[]): number {
  if (positions.length === 0) return GAP
  return Math.max(...positions) + GAP
}

/**
 * Position for a drop between two neighbors (null = list edge).
 * Between = floor((prev+next)/2); top = floor(first/2); bottom = prev + 1024.
 *
 * PRECONDITION: callers must check `needsRenormalize(prev, next)` first and
 * take the renormalize path when it returns true. When no usable gap exists
 * this function returns out-of-contract values — e.g. midpoint(null, 1) === 0
 * (violates position >= 1) and midpoint(1024, 1025) === 1024 (collides with
 * the previous neighbor). `needsRenormalize` is the guard that makes those
 * cases unreachable.
 */
export function midpoint(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return GAP
  if (prev === null) return Math.floor((next as number) / 2)
  if (next === null) return prev + GAP
  return Math.floor((prev + next) / 2)
}

/** True when dropping between these neighbors would close a gap below 2. */
export function needsRenormalize(prev: number | null, next: number | null): boolean {
  const pos = midpoint(prev, next)
  const gapBefore = pos - (prev ?? 0)
  const gapAfter = next === null ? GAP : next - pos
  return gapBefore < MIN_GAP || gapAfter < MIN_GAP
}

/** Renormalize a list (already in visual order) to (index+1)*1024. */
export function renormalize(ids: string[]): { id: string; position: number }[] {
  return ids.map((id, index) => ({ id, position: (index + 1) * GAP }))
}
