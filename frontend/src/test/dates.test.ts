// domain/dates.ts gates dueDate validation (via validation.ts) and the legacy
// migration's migrate-else-null rule, so every branch is pinned here. All
// relative-label assertions pass a FIXED `today` argument — never the wall
// clock — so the suite is deterministic in any timezone on any day.

import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  dueLabel,
  headerDate,
  isDateString,
  isOverdue,
  monthCaption,
} from '../domain/dates'

// 2026-09-07 is a Monday (fixed reference "today" for label tests).
const TODAY = '2026-09-07'

describe('isDateString', () => {
  it('accepts real calendar dates including leap day', () => {
    expect(isDateString('2026-09-07')).toBe(true)
    expect(isDateString('2024-02-29')).toBe(true) // 2024 is a leap year
    expect(isDateString('2026-01-01')).toBe(true)
    expect(isDateString('2026-12-31')).toBe(true)
  })

  it('rejects impossible calendar dates that match the shape', () => {
    expect(isDateString('2023-02-29')).toBe(false) // 2023 is not a leap year
    expect(isDateString('2026-13-01')).toBe(false) // month 13
    expect(isDateString('2026-04-31')).toBe(false) // April has 30 days
    expect(isDateString('2026-00-10')).toBe(false) // month 0
    expect(isDateString('2026-06-00')).toBe(false) // day 0
  })

  it('rejects malformed strings', () => {
    expect(isDateString('')).toBe(false)
    expect(isDateString('not-a-date')).toBe(false)
    expect(isDateString('2026-9-7')).toBe(false) // unpadded
    expect(isDateString('2026/09/07')).toBe(false)
    expect(isDateString('20260907')).toBe(false)
    expect(isDateString('2026-09-07T00:00:00.000Z')).toBe(false)
    expect(isDateString(' 2026-09-07')).toBe(false)
  })
})

describe('dueLabel (fixed today = Monday 2026-09-07)', () => {
  it('diff 0 → Today', () => {
    expect(dueLabel('2026-09-07', TODAY)).toEqual({ text: 'Today', tone: 'today' })
  })

  it('diff 1 → Tomorrow', () => {
    expect(dueLabel('2026-09-08', TODAY)).toEqual({ text: 'Tomorrow', tone: 'future' })
  })

  it('diff 2–6 → short weekday', () => {
    expect(dueLabel('2026-09-09', TODAY)).toEqual({ text: 'Wed', tone: 'future' }) // diff 2
    expect(dueLabel('2026-09-13', TODAY)).toEqual({ text: 'Sun', tone: 'future' }) // diff 6
  })

  it("diff >= 7 → 'Mon D'", () => {
    expect(dueLabel('2026-09-14', TODAY)).toEqual({ text: 'Sep 14', tone: 'future' }) // diff 7
    expect(dueLabel('2027-01-03', TODAY)).toEqual({ text: 'Jan 3', tone: 'future' }) // far future
  })

  it('diff -1 → Yesterday', () => {
    expect(dueLabel('2026-09-06', TODAY)).toEqual({ text: 'Yesterday', tone: 'overdue' })
  })

  it("diff < -1 → 'Nd overdue'", () => {
    expect(dueLabel('2026-09-05', TODAY)).toEqual({ text: '2d overdue', tone: 'overdue' })
    expect(dueLabel('2026-08-07', TODAY)).toEqual({ text: '31d overdue', tone: 'overdue' })
  })
})

describe('isOverdue boundary', () => {
  it('a task due today is NOT overdue', () => {
    expect(isOverdue('2026-09-07', TODAY)).toBe(false)
  })

  it('a task due the day before today IS overdue', () => {
    expect(isOverdue('2026-09-06', TODAY)).toBe(true)
  })

  it('a task due tomorrow is not overdue', () => {
    expect(isOverdue('2026-09-08', TODAY)).toBe(false)
  })
})

describe('daysBetween', () => {
  it('counts exactly 1 day per calendar day across the US spring-forward DST transition (2026-03-08)', () => {
    expect(daysBetween('2026-03-07', '2026-03-08')).toBe(1)
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2) // spans the 23-hour local day
  })

  it('counts exactly 1 day per calendar day across the fall-back DST transition (2026-11-01)', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2) // spans the 25-hour local day
  })

  it('crosses a year boundary', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
    expect(daysBetween('2025-12-25', '2026-01-05')).toBe(11)
  })

  it('is signed: negative when `to` is earlier, zero for the same day', () => {
    expect(daysBetween('2026-01-01', '2025-12-31')).toBe(-1)
    expect(daysBetween('2026-09-07', '2026-09-07')).toBe(0)
  })
})

describe('headerDate', () => {
  it("formats as 'Weekday, Mon D'", () => {
    expect(headerDate('2026-09-06')).toBe('Sunday, Sep 6')
    expect(headerDate('2026-09-07')).toBe('Monday, Sep 7')
    expect(headerDate('2026-01-01')).toBe('Thursday, Jan 1')
  })
})

describe('monthCaption', () => {
  it("formats as 'Mon YYYY'", () => {
    expect(monthCaption(2026, 9)).toBe('Sep 2026')
    expect(monthCaption(2026, 1)).toBe('Jan 2026')
    expect(monthCaption(2027, 12)).toBe('Dec 2027')
  })
})
