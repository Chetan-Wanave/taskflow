import { describe, expect, it } from 'vitest'
import { GAP, appendPosition, midpoint, needsRenormalize, renormalize } from '../domain/position'

describe('appendPosition', () => {
  it('returns 1024 for an empty list', () => {
    expect(appendPosition([])).toBe(1024)
  })

  it('returns max + 1024', () => {
    expect(appendPosition([1024, 2048, 3072])).toBe(4096)
  })

  it('uses the max even when positions are unordered', () => {
    expect(appendPosition([3072, 1024, 2048])).toBe(4096)
  })
})

describe('midpoint', () => {
  it('drops between neighbors at floor((prev+next)/2)', () => {
    expect(midpoint(1024, 2048)).toBe(1536)
    expect(midpoint(1024, 2049)).toBe(1536)
  })

  it('drops at top at floor(first/2)', () => {
    expect(midpoint(null, 1024)).toBe(512)
    expect(midpoint(null, 5)).toBe(2)
  })

  it('drops at bottom at prev + 1024', () => {
    expect(midpoint(2048, null)).toBe(2048 + GAP)
  })

  it('returns 1024 for an empty list', () => {
    expect(midpoint(null, null)).toBe(1024)
  })
})

describe('needsRenormalize (gap < 2)', () => {
  it('is false while gaps stay >= 2', () => {
    expect(needsRenormalize(1024, 2048)).toBe(false)
    expect(needsRenormalize(1024, 1028)).toBe(false) // midpoint 1026, gaps 2/2
    expect(needsRenormalize(null, 4)).toBe(false) // top: 2, gaps 2/2
    expect(needsRenormalize(2048, null)).toBe(false)
  })

  it('is true when a resulting gap closes below 2', () => {
    expect(needsRenormalize(1024, 1026)).toBe(true) // midpoint 1025, gap 1
    expect(needsRenormalize(1024, 1025)).toBe(true) // midpoint 1024, collision
    expect(needsRenormalize(1024, 1027)).toBe(true) // midpoint 1025, gaps 1/2
    expect(needsRenormalize(null, 3)).toBe(true) // top: 1
    expect(needsRenormalize(null, 1)).toBe(true) // top: 0 (invalid position)
  })
})

describe('renormalize', () => {
  it('rewrites the visible list to (index+1)*1024', () => {
    expect(renormalize(['a', 'b', 'c'])).toEqual([
      { id: 'a', position: 1024 },
      { id: 'b', position: 2048 },
      { id: 'c', position: 3072 },
    ])
  })

  it('handles the empty list', () => {
    expect(renormalize([])).toEqual([])
  })
})
